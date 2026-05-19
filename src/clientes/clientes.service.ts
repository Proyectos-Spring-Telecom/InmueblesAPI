import { BadRequestException, HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BitacoraService } from 'src/bitacora/bitacora.service';
import { S3Service } from 'src/s3/s3.service';
import { Clientes } from 'src/entities/Clientes';
import { SociosArrendadores } from 'src/entities/SociosArrendadores';
import { DataSource, In, Repository } from 'typeorm';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { ApiCrudResponse, ApiResponseCommon, EstatusEnumBitcora } from 'src/common/ApiResponse';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { UpdateClienteEstatusDto } from './dto/update-cliente-estatus.dto';
import { getClienteHijos, getClienteHijosPag } from 'src/utils/cliente-utils';
import {
  CLIENTE_ARCHIVO_FIELDS,
  ClienteArchivoField,
} from './cliente-archivos.constants';
import { resolveEntityId } from 'src/common/resolve-entity-id';
import { SocioArrendadorItemDto } from './dto/socio-arrendador-item.dto';
import { UpdateSocioArrendadorDto } from './dto/update-socio-arrendador.dto';

const FOLDER_SOCIO_CONST = 'Socios Arrendadores/ConstanciaSituacionFiscal';
const FOLDER_SOCIO_COMP = 'Socios Arrendadores/ComprobanteDomicilio';
const FOLDER_SOCIO_ID = 'Socios Arrendadores/IdentificacionOficial';
const ID_MODULE = 1;

@Injectable()
export class ClientesService {
    constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    @InjectRepository(SociosArrendadores)
    private readonly sociosArrendadoresRepository: Repository<SociosArrendadores>,
    private readonly bitacoraLogger: BitacoraService,
    private readonly s3Service: S3Service,
  ) {}

  private getMulterFile(value: unknown): Express.Multer.File | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) return value[0];
    if (typeof value === 'object' && 'buffer' in (value as object)) {
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
          'Clientes',
          idUser,
          ID_MODULE,
        );
        (dto as Record<string, unknown>)[field] = uploadResult.url;
      } else {
        delete (dto as Record<string, unknown>)[field];
      }
    }
  }

  private extractSociosPayload(
    dto: CreateClienteDto | UpdateClienteDto,
  ): UpdateSocioArrendadorDto[] {
    const socios = (dto.socios ?? []) as UpdateSocioArrendadorDto[];
    delete dto.socios;
    return socios;
  }

  private sociosResumenBitacora(socios: UpdateSocioArrendadorDto[]) {
    return socios.map((s) => ({
      nombre: s.nombre,
      rfc: s.rfc ?? null,
      constanciaFiscalArchivo: s.constanciaFiscalArchivo ? 'Sí' : 'No',
      comprobanteDomicilioArchivo: s.comprobanteDomicilioArchivo ? 'Sí' : 'No',
      identificacionOficialArchivo: s.identificacionOficialArchivo ? 'Sí' : 'No',
    }));
  }

  private buildSocioArrendadorPatch(
    socio: UpdateSocioArrendadorDto,
  ): Partial<SociosArrendadores> {
    const patch: Partial<SociosArrendadores> = {};
    if (socio.nombre !== undefined) {
      patch.nombre = socio.nombre ?? null;
    }
    if (socio.rfc !== undefined) {
      patch.rfc = socio.rfc ?? null;
    }
    return patch;
  }

  private async uploadSocioArrendadorDocumentos(
    socio: UpdateSocioArrendadorDto,
    idUser: number,
  ): Promise<Partial<SociosArrendadores>> {
    const patch: Partial<SociosArrendadores> = {};

    const fConst = this.getMulterFile(socio.constanciaFiscalArchivo);
    if (fConst) {
      patch.constanciaSituacionFiscal = (
        await this.s3Service.uploadFile(
          fConst,
          FOLDER_SOCIO_CONST,
          idUser,
          ID_MODULE,
        )
      ).url;
    }

    const fComp = this.getMulterFile(socio.comprobanteDomicilioArchivo);
    if (fComp) {
      patch.comprobanteDomicilio = (
        await this.s3Service.uploadFile(
          fComp,
          FOLDER_SOCIO_COMP,
          idUser,
          ID_MODULE,
        )
      ).url;
    }

    const fId = this.getMulterFile(socio.identificacionOficialArchivo);
    if (fId) {
      patch.identificacionOficial = (
        await this.s3Service.uploadFile(fId, FOLDER_SOCIO_ID, idUser, ID_MODULE)
      ).url;
    }

    return patch;
  }

  private async upsertSocioArrendador(
    socio: UpdateSocioArrendadorDto,
    idCliente: number,
    idUser: number,
    manager: import('typeorm').EntityManager | undefined,
    upsert: boolean,
  ): Promise<{ id: number; nombre: string }> {
    const repo = manager
      ? manager.getRepository(SociosArrendadores)
      : this.sociosArrendadoresRepository;

    const entityId = upsert ? resolveEntityId(socio.id) : undefined;
    const filePatch = await this.uploadSocioArrendadorDocumentos(socio, idUser);

    if (entityId !== undefined) {
      const existing = await repo.findOne({
        where: { id: entityId, idCliente },
      });
      if (!existing) {
        throw new BadRequestException(
          `Socio con id ${entityId} no pertenece al cliente ${idCliente}.`,
        );
      }
      const patch = {
        ...this.buildSocioArrendadorPatch(socio),
        ...filePatch,
      };
      if (Object.keys(patch).length > 0) {
        await repo.update(entityId, patch);
      }
      const updated = await repo.findOne({ where: { id: entityId } });
      return {
        id: entityId,
        nombre: updated?.nombre ?? existing.nombre ?? '',
      };
    }

    if (!socio.nombre?.trim()) {
      throw new BadRequestException(
        'Para crear un socio nuevo se requiere nombre.',
      );
    }

    const row = repo.create({
      idCliente,
      nombre: socio.nombre,
      rfc: socio.rfc ?? null,
      constanciaSituacionFiscal: filePatch.constanciaSituacionFiscal ?? null,
      comprobanteDomicilio: filePatch.comprobanteDomicilio ?? null,
      identificacionOficial: filePatch.identificacionOficial ?? null,
    });
    const saved = await repo.save(row);
    return { id: Number(saved.id), nombre: socio.nombre };
  }

  private async appendSociosArrendadores(
    socios: SocioArrendadorItemDto[] | UpdateSocioArrendadorDto[],
    idCliente: number,
    idUser: number,
    manager?: import('typeorm').EntityManager,
  ): Promise<{ id: number; nombre: string }[]> {
    return this.upsertSociosArrendadores(
      socios as UpdateSocioArrendadorDto[],
      idCliente,
      idUser,
      manager,
      false,
    );
  }

  private async upsertSociosArrendadores(
    socios: UpdateSocioArrendadorDto[],
    idCliente: number,
    idUser: number,
    manager?: import('typeorm').EntityManager,
    upsert = true,
  ): Promise<{ id: number; nombre: string }[]> {
    const out: { id: number; nombre: string }[] = [];
    for (const socio of socios) {
      out.push(
        await this.upsertSocioArrendador(
          socio,
          idCliente,
          idUser,
          manager,
          upsert,
        ),
      );
    }
    return out;
  }

  private async attachSociosArrendadores<T extends { id: number }>(
    clientes: T[],
  ): Promise<(T & { sociosArrendadores: SociosArrendadores[] })[]> {
    if (clientes.length === 0) return [];

    const ids = clientes.map((c) => c.id);
    const socios = await this.sociosArrendadoresRepository.find({
      where: { idCliente: In(ids) },
      order: { id: 'ASC' },
    });

    const byCliente = new Map<number, SociosArrendadores[]>();
    for (const socio of socios) {
      const key = Number(socio.idCliente);
      const list = byCliente.get(key) ?? [];
      list.push(socio);
      byCliente.set(key, list);
    }

    return clientes.map((c) => ({
      ...c,
      sociosArrendadores: byCliente.get(c.id) ?? [],
    }));
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
        record[field] ? 'Sí' : 'No',
      ]),
    ) as Record<ClienteArchivoField, string>;
  }

  async createCliente(
    createClienteDto: CreateClienteDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    const socios = this.extractSociosPayload(createClienteDto);

    try {
      const clienteCreate = await this.clienteRepository.findOne({
        where: {
          rfc: createClienteDto.rfc,
        },
      });
      if (clienteCreate) {
        throw new BadRequestException(
          `Cliente ya registrado con RFC: ${createClienteDto.rfc}. Por favor, ingrese un RFC diferente.`,
        );
      }

      await this.applyClienteArchivos(createClienteDto, idUser);

      const clienteCreado = await this.dataSource.transaction(async (manager) => {
        const clienteData = manager.create(Clientes, createClienteDto);
        const saved = await manager.save(Clientes, clienteData);
        const idCliente = Number(saved.id);

        if (socios.length > 0) {
          await this.appendSociosArrendadores(
            socios,
            idCliente,
            idUser,
            manager,
          );
        }
        return saved;
      });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = JSON.parse(
        JSON.stringify({
          createClienteDto: this.omitClienteArchivos(createClienteDto),
          archivosSubidos: this.archivosSubidosFlags(createClienteDto),
          socios: this.sociosResumenBitacora(socios),
        }),
      );
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Cliente creado correctamente con RFC: ${createClienteDto.rfc}.`,
        'CREATE',
        querylogger,
        idUser,
        1,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El cliente ha sido creado correctamente.',
        data: {
          id: clienteCreado.id,
          nombre:
            `${clienteCreado.nombre} ${clienteCreado.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = JSON.parse(
        JSON.stringify({
          createClienteDto: this.omitClienteArchivos(createClienteDto),
          archivosSubidos: this.archivosSubidosFlags(createClienteDto),
          socios: this.sociosResumenBitacora(socios),
        }),
      );
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Error al crear cliente con RFC: ${createClienteDto.rfc}.`,
        'CREATE',
        querylogger,
        idUser,
        1,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al intentar crear un cliente.',
        error: error.message,
      });
    }
  }


  // ========================================
  // 🔹 OBTENER PAGINADO DE CLIENTES
  // ========================================
  async getAllClientes(
    idUser: number,
    cliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const offset = (page - 1) * limit;
      let totalResult;
      let clientes;
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador - obtiene todas las regiones
          clientes = await this.clienteRepository.query(
            `
SELECT
  Id AS id,
  RFC AS rfc,
  TipoPersona AS tipoPersona,
  Nombre AS nombre,
  ApellidoPaterno AS apellidoPaterno,
  ApellidoMaterno AS apellidoMaterno,
  Telefono AS telefono,
  Correo AS correo,
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
  LicenciaFuncionamiento AS licenciaFuncionamiento,
  ConstanciaProteccionCivil AS constanciaProteccionCivil,
  UsoSuelo AS usoSuelo,
  PlanoCatastral AS planoCatastral,
  PoderRepresentanteLegal AS poderRepresentanteLegal,
  IneRepresentanteLegal AS ineRepresentanteLegal
  
FROM Clientes
ORDER BY Id ASC
  LIMIT ? OFFSET ?;
            `,
            [ limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.clienteRepository.query(
            `
  SELECT COUNT(*) AS total
FROM Clientes

  `, 
          );
          break;

        default:
           const { ids, placeholders } = await getClienteHijosPag(this.clienteRepository, cliente);
          
          // Si no hay IDs, retornar resultados vacíos
          if (ids.length === 0 || !placeholders) {
            clientes = [];
            totalResult = [{ total: 0 }];
          } else {
            clientes = await this.clienteRepository.query(
              `
SELECT
  Id AS id,
  RFC AS rfc,
  TipoPersona AS tipoPersona,
  Nombre AS nombre,
  ApellidoPaterno AS apellidoPaterno,
  ApellidoMaterno AS apellidoMaterno,
  Telefono AS telefono,
  Correo AS correo,
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
  LicenciaFuncionamiento AS licenciaFuncionamiento,
  ConstanciaProteccionCivil AS constanciaProteccionCivil,
  UsoSuelo AS usoSuelo,
  PlanoCatastral AS planoCatastral,
  PoderRepresentanteLegal AS poderRepresentanteLegal,
  IneRepresentanteLegal AS ineRepresentanteLegal
  
FROM Clientes
WHERE Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
ORDER BY Id ASC
  LIMIT ? OFFSET ?;
              `,
              [...ids, limit, offset],
            );

            // Query para total (sin paginación)
            totalResult = await this.clienteRepository.query(
              `
  SELECT COUNT(*) AS total
FROM Clientes
WHERE Id IN (${placeholders})    -- 🔹 aquí colocas el ID del cliente que quieres consultar
ORDER BY Id ASC

  `,
              [...ids],
            );
          }
          break;
      }

      const data = await this.attachSociosArrendadores(
        clientes.map((item) => ({
          ...item,
          id: Number(item.id),
        })),
      );

      const total = Number(totalResult[0]?.total || 0);

      const result: ApiResponseCommon = {
        data,
        paginated: {
          total: total,
          page,
          lastPage: Math.ceil(total / limit),
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Ocurrió un error al obtener paginados de los clientes.',
      });
    }
  }

  // ========================================
  // 🔹 OBTENER UN LISTADO DE CLIENTES
  // ========================================
  async getAllListClientes(
    idUser: number,
    cliente: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    try {
      let clientes;
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador - obtiene todas las regiones
          clientes = await this.clienteRepository.query(
            `
SELECT
  Id AS id,
  Nombre AS nombre,
  ApellidoPaterno AS apellidoPaterno,
  ApellidoMaterno AS apellidoMaterno,
  Logotipo AS logotipo
FROM Clientes
WHERE Estatus = 1
ORDER BY Id ASC;
            `,
          );
          break;

        default:
            // Usuarios normales - solo sus regiones asignadas
           const { ids, placeholders } = await getClienteHijos(this.clienteRepository, cliente);
          
          // Si no hay IDs, retornar resultados vacíos
          if (ids.length === 0 || !placeholders) {
            clientes = [];
          } else {
            clientes = await this.clienteRepository.query(
              `
SELECT
  Id AS id,
  Nombre AS nombre,
  ApellidoPaterno AS apellidoPaterno,
  ApellidoMaterno AS apellidoMaterno,
  Logotipo AS logotipo
FROM Clientes
WHERE Id IN (${placeholders})  -- 🔹 aquí colocas el ID del cliente que quieres consultar
  AND Estatus = 1
ORDER BY Id ASC;

              `,
              [...ids],
            );
          }
          break;
      }

      // 🔥 Forzamos ids a number y agregamos nombreCompleto
      const data = clientes.map((item) => ({
        ...item,
        id: Number(item.id),
      }));

      const result: ApiResponseCommon = {
        data: data,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Ocurrió un error al obtener listado de los clientes.',
      });
    }
  }

  //Obtener el cliente por ID
  async getOneCliente(id: number) {
    try {
      const cliente = await this.clienteRepository.findOne({
        where: { id: id },
        relations: ['sociosArrendadores'],
      });
      if (!cliente) {
        throw new NotFoundException(
          `El cliente con ID: ${id} no fue encontrado.`,
        );
      }
      return { data: cliente };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: `Error al obtener el cliente con ID: ${id}.`,
      });
    }
  }

  //Actualizar informacion del cliente
  async updateCliente(
    id: number,
    idUser: number,
    updateClienteDto: UpdateClienteDto,
  ): Promise<ApiCrudResponse> {
    const socios = this.extractSociosPayload(updateClienteDto);

    try {
      const Cliente = await this.clienteRepository.findOne({
        where: { id: id },
      });
      if (!Cliente) {
        throw new NotFoundException(
          `El cliente con ID: ${id} no fue encontrado.`,
        );
      }

      await this.applyClienteArchivos(updateClienteDto, idUser);

      const clienteData = await this.clienteRepository.create(updateClienteDto);
      await this.clienteRepository.update(id, clienteData);

      if (socios.length > 0) {
        await this.upsertSociosArrendadores(socios, id, idUser);
      }

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = JSON.parse(
        JSON.stringify({
          updateClienteDto: this.omitClienteArchivos(updateClienteDto),
          archivosSubidos: this.archivosSubidosFlags(updateClienteDto),
          socios: this.sociosResumenBitacora(socios),
        }),
      );
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Cliente con ID: ${id} actualizado correctamente.`,
        'UPDATE',
        querylogger,
        idUser,
        1,
        EstatusEnumBitcora.SUCCESS,
      );

      //Hacemos un expose que convierta los atributos en PascalCase
      const clientefind = await this.clienteRepository.findOne({
        where: { id: id },
        relations: ['sociosArrendadores'],
      });
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Cliente actualizado correctamente.',
        data: {
          id: id,
          nombre:
            `${clientefind?.nombre} ${clientefind?.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = JSON.parse(
        JSON.stringify({
          updateClienteDto: this.omitClienteArchivos(updateClienteDto),
          archivosSubidos: this.archivosSubidosFlags(updateClienteDto),
          socios: this.sociosResumenBitacora(socios),
        }),
      );
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Error al actualizar cliente con ID: ${id}.`,
        'UPDATE',
        querylogger,
        idUser,
        1,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Error al actualizar la información del cliente con ID: ${id}`,
        error: error.message,
      });
    }
  }
  //Cambiar el estatus del cliente
  async updateClienteStatus(
    id: number,
    idUser: number,
    updateClienteEstatusDto: UpdateClienteEstatusDto,
  ): Promise<ApiCrudResponse> {
    try {
      const usuario = await this.clienteRepository.findOne({
        where: { id: id },
      });
      if (!usuario) {
        throw new NotFoundException(`Cliente con ID: ${id} no encontrado`);
      }
      const estatus = updateClienteEstatusDto.estatus;
      await this.clienteRepository.update(id, { estatus });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateClienteEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `El estatus del cliente con ID ${id} se modificó exitosamente a: ${estatus}.`,
        'UPDATE',
        querylogger,
        idUser,
        1,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus del cliente actualizado correctamente.',
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre: `${usuario.nombre} ${usuario.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateClienteEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Se cambió el estatus del cliente con ID: ${id} a estatus: ${updateClienteEstatusDto.estatus}.`,
        'UPDATE',
        querylogger,
        idUser,
        1,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Error al cambiar el estatus del cliente con ID: ${id}.`,
        error: error.message,
      });
    }
  }
  //Eliminar cliente
  async removeCliente(id: number, idUser: number): Promise<ApiCrudResponse> {
    try {
      const clienteEliminar = await this.clienteRepository.findOne({
        where: { id: id },
      });
      if (!clienteEliminar) {
        throw new NotFoundException(
          `El cliente con ID: ${id} no fue encontrado.`,
        );
      }
      await this.clienteRepository.update(id, { estatus: 0 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Se eliminó el cliente con ID: ${id}.`,
        'UPDATE',
        querylogger,
        Number(idUser),
        1,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El cliente fue eliminado correctamente.',
        data: {
          id: id,
          nombre:
            `${clienteEliminar.nombre} ${clienteEliminar.apellidoPaterno} ` ||
            '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Se eliminó el cliente con ID: ${id}.`,
        'UPDATE',
        querylogger,
        Number(idUser),
        1,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Error al eliminar el cliente con ID: ${id}.`,
        error: error.message,
      });
    }
  }
}
