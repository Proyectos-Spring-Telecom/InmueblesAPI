import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { BitacoraService } from "src/bitacora/bitacora.service";
import { S3Service } from "src/s3/s3.service";
import { Clientes } from "src/entities/Clientes";
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from "src/common/ApiResponse";
import { isSuperAdmin } from "src/utils/cliente-utils";
import {
  canSeeInactive,
  filterByEstatusRol,
} from "src/utils/estatus-utils";
import {
  CLIENTE_ARCHIVO_FIELDS,
  ClienteArchivoField,
} from "./cliente-archivos.constants";
import { CreateClienteDto } from "./dto/create-cliente.dto";
import { UpdateClienteDto } from "./dto/update-cliente.dto";
import { UpdateClienteEstatusDto } from "./dto/update-cliente-estatus.dto";
import { EmbudoVentasService } from "src/embudo-ventas/embudo-ventas.service";

const ID_MODULE = 1;
const S3_FOLDER = "Clientes";
const ROL_VENDEDOR = 8;

const SELECT_CLIENTE_LIST = `
  Id AS id,
  IdPadre AS idPadre,
  RFC AS rfc,
  TipoPersona AS tipoPersona,
  Nombre AS nombre,
  ApellidoPaterno AS apellidoPaterno,
  ApellidoMaterno AS apellidoMaterno,
  Telefono AS telefono,
  Correo AS correo,
  SitioWeb AS sitioWeb,
  Estado AS estado,
  Municipio AS municipio,
  Colonia AS colonia,
  Calle AS calle,
  EntreCalles AS entreCalles,
  NumeroExterior AS numeroExterior,
  NumeroInterior AS numeroInterior,
  CP AS cp,
  NombreEncargado AS nombreEncargado,
  TelefonoEncargado AS telefonoEncargado,
  CorreoEncargado AS correoEncargado,
  ConstanciaSituacionFiscal AS constanciaSituacionFiscal,
  ComprobanteDomicilio AS comprobanteDomicilio,
  ActaConstitutiva AS actaConstitutiva,
  Logotipo AS logotipo,
  Estatus AS estatus,
  EsProspecto AS esProspecto
`;

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Clientes)
    private readonly clientesRepository: Repository<Clientes>,
    private readonly bitacoraLogger: BitacoraService,
    private readonly s3Service: S3Service,
    private readonly dataSource: DataSource,
    private readonly embudoVentasService: EmbudoVentasService,
  ) {}

  private getMulterFile(value: unknown): Express.Multer.File | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) return value[0];
    if (typeof value === "object" && "buffer" in (value as object)) {
      return value as Express.Multer.File;
    }
    return undefined;
  }

  private async applyClienteArchivos(
    dto: CreateClienteDto | UpdateClienteDto,
    idUser: number,
  ): Promise<void> {
    for (const field of CLIENTE_ARCHIVO_FIELDS) {
      const file = this.getMulterFile((dto as Record<string, unknown>)[field]);
      if (file) {
        const uploadResult = await this.s3Service.uploadFile(
          file,
          S3_FOLDER,
          idUser,
          ID_MODULE,
        );
        (dto as Record<string, unknown>)[field] = uploadResult.url;
      } else {
        delete (dto as Record<string, unknown>)[field];
      }
    }
  }

  private omitClienteArchivos(
    dto: CreateClienteDto | UpdateClienteDto,
  ): Omit<CreateClienteDto, ClienteArchivoField> {
    const copy = { ...dto } as Record<string, unknown>;
    for (const field of CLIENTE_ARCHIVO_FIELDS) {
      delete copy[field];
    }
    return copy as Omit<CreateClienteDto, ClienteArchivoField>;
  }

  private archivosSubidosFlags(
    dto: CreateClienteDto | UpdateClienteDto,
  ): Record<ClienteArchivoField, string> {
    const record = dto as Record<string, unknown>;
    return Object.fromEntries(
      CLIENTE_ARCHIVO_FIELDS.map((field) => [
        field,
        record[field] ? "Sí" : "No",
      ]),
    ) as Record<ClienteArchivoField, string>;
  }

  private nombreCompleto(c: {
    nombre?: string | null;
    apellidoPaterno?: string | null;
  }): string {
    return `${c.nombre ?? ""} ${c.apellidoPaterno ?? ""}`.trim();
  }

  async createCliente(
    createClienteDto: CreateClienteDto,
    idUser: number,
  ): Promise<ApiCrudResponse & { idEmbudoVentas?: number | null }> {
    try {
      const existing = await this.clientesRepository.findOne({
        where: { rfc: createClienteDto.rfc },
      });
      if (existing) {
        throw new BadRequestException(
          `Cliente ya registrado con RFC: ${createClienteDto.rfc}.`,
        );
      }

      await this.applyClienteArchivos(createClienteDto, idUser);

      if (createClienteDto.esProspecto == null) {
        createClienteDto.esProspecto = false;
      }

      const esProspecto = createClienteDto.esProspecto === true;
      let embudoId: number | null = null;

      const saved = await this.dataSource.transaction(async (manager) => {
        const entity = manager.create(Clientes, createClienteDto);
        const savedCliente = await manager.save(entity);
        if (esProspecto) {
          const embudo = await this.embudoVentasService.crearInicial(
            Number(savedCliente.id),
            Number(idUser),
            manager,
          );
          embudoId = Number(embudo.id);
        }
        return savedCliente;
      });

      const querylogger = {
        createClienteDto: this.omitClienteArchivos(createClienteDto),
        archivosSubidos: this.archivosSubidosFlags(createClienteDto),
        esProspecto,
        id: Number(saved.id),
        idEmbudoVentas: embudoId,
      };
      await this.bitacoraLogger.logToBitacora(
        "Clientes",
        esProspecto
          ? `Prospecto creado correctamente con RFC: ${createClienteDto.rfc}.`
          : `Cliente creado correctamente con RFC: ${createClienteDto.rfc}.`,
        "CREATE",
        querylogger,
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.SUCCESS,
      );

      if (esProspecto && embudoId != null) {
        await this.bitacoraLogger.logToBitacora(
          "EmbudoVentas",
          `Embudo de ventas registrado para el prospecto con ID ${Number(saved.id)} (estatus Registrado).`,
          "CREATE",
          {
            idEmbudoVentas: embudoId,
            idCliente: Number(saved.id),
            idUsuario: idUser,
            estatus: 1,
          },
          idUser,
          ID_MODULE,
          EstatusEnumBitcora.SUCCESS,
        );
      }

      return {
        status: "success",
        message: esProspecto
          ? "El prospecto ha sido creado correctamente."
          : "El cliente ha sido creado correctamente.",
        idEmbudoVentas: embudoId,
        data: {
          id: Number(saved.id),
          nombre: this.nombreCompleto(saved),
        },
      };
    } catch (error) {
      const esProspecto = createClienteDto.esProspecto === true;
      const querylogger = {
        createClienteDto: this.omitClienteArchivos(createClienteDto),
        archivosSubidos: this.archivosSubidosFlags(createClienteDto),
        esProspecto,
      };
      await this.bitacoraLogger.logToBitacora(
        "Clientes",
        esProspecto
          ? `Error al crear prospecto con RFC: ${createClienteDto.rfc}.`
          : `Error al crear cliente con RFC: ${createClienteDto.rfc}.`,
        "CREATE",
        querylogger,
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: "Ocurrió un error al intentar crear un cliente.",
        error: error.message,
      });
    }
  }

  async getAllClientes(
    idUser: number,
    cliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    return this.findClientesPaginados(
      cliente,
      rol,
      page,
      limit,
      false,
      "Ocurrió un error al obtener clientes paginados.",
    );
  }

  async getAllProspectos(
    idUser: number,
    _cliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const offset = (page - 1) * limit;
      const esVendedor = Number(rol) === ROL_VENDEDOR;
      const filtroVendedor = esVendedor
        ? `AND EXISTS (
            SELECT 1
            FROM EmbudoVentas e
            WHERE e.IdCliente = Clientes.Id
              AND e.IdUsuario = ?
          )`
        : "";
      const paramsLista = esVendedor
        ? [1, idUser, limit, offset]
        : [1, limit, offset];
      const paramsTotal = esVendedor ? [1, idUser] : [1];

      const rows = await this.clientesRepository.query(
        `
SELECT ${SELECT_CLIENTE_LIST}
FROM Clientes
WHERE EsProspecto = ?
${filtroVendedor}
ORDER BY Id ASC
LIMIT ? OFFSET ?;
        `,
        paramsLista,
      );
      const totalResult = await this.clientesRepository.query(
        `
SELECT COUNT(*) AS total
FROM Clientes
WHERE EsProspecto = ?
${filtroVendedor}
        `,
        paramsTotal,
      );

      const data = rows.map((item) => ({
        ...item,
        id: Number(item.id),
        idPadre: item.idPadre != null ? Number(item.idPadre) : null,
        esProspecto: Number(item.esProspecto) === 1,
      }));
      const total = Number(totalResult[0]?.total || 0);
      return {
        data,
        paginated: {
          total,
          page,
          lastPage: Math.ceil(total / limit) || 0,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException({
        message: "Ocurrió un error al obtener prospectos paginados.",
      });
    }
  }

  private async findClientesPaginados(
    cliente: number,
    rol: number,
    page: number,
    limit: number,
    esProspecto: boolean,
    errorMessage: string,
  ): Promise<ApiResponseCommon> {
    try {
      const offset = (page - 1) * limit;
      const prospecto = esProspecto ? 1 : 0;
      let rows: any[];
      let totalResult: any[];

      if (isSuperAdmin(rol)) {
        rows = await this.clientesRepository.query(
          `
SELECT ${SELECT_CLIENTE_LIST}
FROM Clientes
WHERE EsProspecto = ?
ORDER BY Id ASC
LIMIT ? OFFSET ?;
          `,
          [prospecto, limit, offset],
        );
        totalResult = await this.clientesRepository.query(
          `SELECT COUNT(*) AS total FROM Clientes WHERE EsProspecto = ?`,
          [prospecto],
        );
      } else {
        // Rol > 1: solo su propio cliente (y hijos por IdPadre) activos
        rows = await this.clientesRepository.query(
          `
SELECT ${SELECT_CLIENTE_LIST}
FROM Clientes
WHERE (Id = ? OR IdPadre = ?)
  AND Estatus = 1
  AND EsProspecto = ?
ORDER BY Id ASC
LIMIT ? OFFSET ?;
          `,
          [cliente, cliente, prospecto, limit, offset],
        );
        totalResult = await this.clientesRepository.query(
          `
SELECT COUNT(*) AS total
FROM Clientes
WHERE (Id = ? OR IdPadre = ?)
  AND Estatus = 1
  AND EsProspecto = ?
          `,
          [cliente, cliente, prospecto],
        );
      }

      const data = rows.map((item) => ({
        ...item,
        id: Number(item.id),
        idPadre: item.idPadre != null ? Number(item.idPadre) : null,
        esProspecto: Number(item.esProspecto) === 1,
      }));

      const total = Number(totalResult[0]?.total || 0);
      return {
        data,
        paginated: {
          total,
          page,
          lastPage: Math.ceil(total / limit) || 0,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException({
        message: errorMessage,
      });
    }
  }

  async getAllListClientes(
    idUser: number,
    cliente: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    try {
      let rows: any[];

      if (isSuperAdmin(rol)) {
        rows = await this.clientesRepository.query(
          `
SELECT
  Id AS id,
  Nombre AS nombre,
  ApellidoPaterno AS apellidoPaterno,
  ApellidoMaterno AS apellidoMaterno,
  Logotipo AS logotipo
FROM Clientes
ORDER BY Id ASC;
          `,
        );
      } else {
        rows = await this.clientesRepository.query(
          `
SELECT
  Id AS id,
  Nombre AS nombre,
  ApellidoPaterno AS apellidoPaterno,
  ApellidoMaterno AS apellidoMaterno,
  Logotipo AS logotipo
FROM Clientes
WHERE (Id = ? OR IdPadre = ?)
  AND Estatus = 1
ORDER BY Id ASC;
          `,
          [cliente, cliente],
        );
      }

      return {
        data: rows.map((item) => ({
          ...item,
          id: Number(item.id),
        })),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException({
        message: "Ocurrió un error al obtener el listado de clientes.",
      });
    }
  }

  async getOneCliente(id: number, rol = 1, idUser = 0) {
    try {
      const where: { id: number; estatus?: number } = { id };
      if (!canSeeInactive(rol)) {
        where.estatus = 1;
      }

      const cliente = await this.clientesRepository.findOne({
        where,
        relations: ["arrendadores"],
      });
      if (!cliente) {
        throw new NotFoundException(
          `El cliente con ID: ${id} no fue encontrado.`,
        );
      }

      if (Number(rol) === ROL_VENDEDOR && cliente.esProspecto) {
        const propios = await this.clientesRepository.query(
          `
SELECT e.Id
FROM EmbudoVentas e
WHERE e.IdCliente = ?
  AND e.IdUsuario = ?
LIMIT 1
          `,
          [id, idUser],
        );
        if (!propios.length) {
          throw new NotFoundException(
            `El cliente con ID: ${id} no fue encontrado.`,
          );
        }
      }

      cliente.arrendadores = filterByEstatusRol(cliente.arrendadores, rol);
      return { data: cliente };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException({
        message: `Error al obtener el cliente con ID: ${id}.`,
      });
    }
  }

  async updateCliente(
    id: number,
    idUser: number,
    updateClienteDto: UpdateClienteDto,
  ): Promise<ApiCrudResponse> {
    try {
      const existing = await this.clientesRepository.findOne({ where: { id } });
      if (!existing) {
        throw new NotFoundException(
          `El cliente con ID: ${id} no fue encontrado.`,
        );
      }

      if (
        updateClienteDto.rfc &&
        updateClienteDto.rfc !== existing.rfc
      ) {
        const rfcTaken = await this.clientesRepository.findOne({
          where: { rfc: updateClienteDto.rfc },
        });
        if (rfcTaken) {
          throw new BadRequestException(
            `Ya existe un cliente con RFC: ${updateClienteDto.rfc}.`,
          );
        }
      }

      await this.applyClienteArchivos(updateClienteDto, idUser);
      await this.clientesRepository.update(id, updateClienteDto as any);

      const querylogger = {
        updateClienteDto: this.omitClienteArchivos(updateClienteDto),
        archivosSubidos: this.archivosSubidosFlags(updateClienteDto),
      };
      await this.bitacoraLogger.logToBitacora(
        "Clientes",
        `Cliente con ID: ${id} actualizado correctamente.`,
        "UPDATE",
        querylogger,
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.clientesRepository.findOne({ where: { id } });
      return {
        status: "success",
        message: "Cliente actualizado correctamente.",
        data: {
          id,
          nombre: this.nombreCompleto(updated ?? {}),
        },
      };
    } catch (error) {
      const querylogger = {
        updateClienteDto: this.omitClienteArchivos(updateClienteDto),
        archivosSubidos: this.archivosSubidosFlags(updateClienteDto),
      };
      await this.bitacoraLogger.logToBitacora(
        "Clientes",
        `Error al actualizar cliente con ID: ${id}.`,
        "UPDATE",
        querylogger,
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: `Error al actualizar el cliente con ID: ${id}`,
        error: error.message,
      });
    }
  }

  async convertirProspectoACliente(
    id: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const cliente = await this.clientesRepository.findOne({ where: { id } });
      if (!cliente) {
        throw new NotFoundException(`Cliente con ID: ${id} no encontrado`);
      }

      const esProspecto =
        cliente.esProspecto === true || Number(cliente.esProspecto) === 1;
      if (!esProspecto) {
        throw new BadRequestException(
          "Solo se puede cambiar EsProspecto de true a false. Este cliente ya no es prospecto.",
        );
      }

      await this.clientesRepository.update(id, { esProspecto: false });

      await this.bitacoraLogger.logToBitacora(
        "Clientes",
        `Prospecto con ID ${id} cambió a cliente (EsProspecto de true a false).`,
        "UPDATE",
        {
          id,
          rfc: cliente.rfc,
          esProspectoAnterior: true,
          esProspecto: false,
        },
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: "success",
        message: "El prospecto se actualizó a cliente correctamente.",
        data: {
          id,
          nombre: this.nombreCompleto(cliente),
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        "Clientes",
        `Error al cambiar el prospecto con ID ${id} a cliente.`,
        "UPDATE",
        { id, esProspectoAnterior: true, esProspecto: false },
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: `Error al actualizar EsProspecto del cliente con ID: ${id}.`,
        error: error.message,
      });
    }
  }

  async updateClienteStatus(
    id: number,
    idUser: number,
    updateClienteEstatusDto: UpdateClienteEstatusDto,
  ): Promise<ApiCrudResponse> {
    try {
      const cliente = await this.clientesRepository.findOne({ where: { id } });
      if (!cliente) {
        throw new NotFoundException(`Cliente con ID: ${id} no encontrado`);
      }

      const estatus = updateClienteEstatusDto.estatus;
      await this.clientesRepository.update(id, { estatus });

      await this.bitacoraLogger.logToBitacora(
        "Clientes",
        `Estatus del cliente ID ${id} cambiado a: ${estatus}.`,
        "UPDATE",
        { updateClienteEstatusDto },
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: "success",
        message: "Estatus del cliente actualizado correctamente.",
        estatus: { estatus },
        data: {
          id,
          nombre: this.nombreCompleto(cliente),
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        "Clientes",
        `Error al cambiar estatus del cliente ID: ${id}.`,
        "UPDATE",
        { updateClienteEstatusDto },
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: `Error al cambiar el estatus del cliente con ID: ${id}.`,
        error: error.message,
      });
    }
  }

  async removeCliente(id: number, idUser: number): Promise<ApiCrudResponse> {
    try {
      const cliente = await this.clientesRepository.findOne({ where: { id } });
      if (!cliente) {
        throw new NotFoundException(
          `El cliente con ID: ${id} no fue encontrado.`,
        );
      }

      await this.clientesRepository.update(id, { estatus: 0 });

      await this.bitacoraLogger.logToBitacora(
        "Clientes",
        `Cliente con ID: ${id} desactivado correctamente.`,
        "DELETE",
        { id },
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: "success",
        message: "Cliente desactivado correctamente.",
        data: {
          id,
          nombre: this.nombreCompleto(cliente),
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        "Clientes",
        `Error al desactivar cliente con ID: ${id}.`,
        "DELETE",
        { id },
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: `Error al eliminar el cliente con ID: ${id}.`,
        error: error.message,
      });
    }
  }
}
