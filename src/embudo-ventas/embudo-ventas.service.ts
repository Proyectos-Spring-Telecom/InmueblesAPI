import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, Repository } from "typeorm";
import { BitacoraService } from "src/bitacora/bitacora.service";
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from "src/common/ApiResponse";
import { Clientes } from "src/entities/Clientes";
import { EmbudoVentas } from "src/entities/EmbudoVentas";
import { EventosEmbudoVentas } from "src/entities/EventosEmbudoVentas";
import { isSuperAdmin } from "src/utils/cliente-utils";
import { CreateEventoEmbudoVentasDto } from "./dto/create-evento-embudo-ventas.dto";
import { UpdateEventoEmbudoVentasDto } from "./dto/update-evento-embudo-ventas.dto";

const ID_MODULE = 1;
const ESTATUS_EMBUDO_REGISTRADO = 1;
const ROL_VENDEDOR = 8;

const MEDIO_COMUNICACION: Record<number, string> = {
  1: "Llamada",
  2: "Correo",
  3: "Visita",
};

@Injectable()
export class EmbudoVentasService {
  constructor(
    @InjectRepository(EmbudoVentas)
    private readonly embudoRepository: Repository<EmbudoVentas>,
    @InjectRepository(EventosEmbudoVentas)
    private readonly eventosRepository: Repository<EventosEmbudoVentas>,
    @InjectRepository(Clientes)
    private readonly clientesRepository: Repository<Clientes>,
    private readonly dataSource: DataSource,
    private readonly bitacoraLogger: BitacoraService,
  ) {}

  async crearInicial(
    idCliente: number,
    idUsuario: number,
    manager?: EntityManager,
  ): Promise<EmbudoVentas> {
    const repo = manager
      ? manager.getRepository(EmbudoVentas)
      : this.embudoRepository;
    const embudo = repo.create({
      idUsuario,
      idCliente,
      estatus: ESTATUS_EMBUDO_REGISTRADO,
    });
    return repo.save(embudo);
  }

  async createEvento(
    idEmbudoVentas: number,
    dto: CreateEventoEmbudoVentasDto,
    idUser: number,
    cliente: number,
    rol: number,
  ): Promise<ApiCrudResponse> {
    try {
      await this.obtenerEmbudoAccesible(idEmbudoVentas, idUser, cliente, rol);
      const estatus = dto.estatus ?? 0;

      const saved = await this.dataSource.transaction(async (manager) => {
        const evento = manager.create(EventosEmbudoVentas, {
          idEmbudoVentas,
          fhProximoEvento: new Date(dto.fhProximoEvento),
          medioComunicacion: dto.medioComunicacion,
          estatus,
          comentario: dto.comentario?.trim() || null,
        });
        const savedEvento = await manager.save(evento);
        await manager.update(EmbudoVentas, idEmbudoVentas, {
          fhUpdate: new Date(),
        });
        return savedEvento;
      });

      await this.bitacoraLogger.logToBitacora(
        "EmbudoVentas",
        `Evento de embudo ${idEmbudoVentas} registrado (${MEDIO_COMUNICACION[dto.medioComunicacion]}).`,
        "CREATE",
        {
          idEmbudoVentas,
          idEvento: Number(saved.id),
          fhProximoEvento: dto.fhProximoEvento,
          medioComunicacion: dto.medioComunicacion,
          estatus,
          comentario: dto.comentario?.trim() || null,
        },
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: "success",
        message: "El evento del embudo se registró correctamente.",
        data: {
          id: Number(saved.id),
          nombre: MEDIO_COMUNICACION[dto.medioComunicacion],
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        "EmbudoVentas",
        `Error al registrar evento del embudo ${idEmbudoVentas}.`,
        "CREATE",
        {
          idEmbudoVentas,
          fhProximoEvento: dto.fhProximoEvento,
          medioComunicacion: dto.medioComunicacion,
          estatus: dto.estatus ?? 0,
          comentario: dto.comentario?.trim() || null,
        },
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: "Ocurrió un error al registrar el evento del embudo.",
        error: error.message,
      });
    }
  }

  async updateEvento(
    idEvento: number,
    dto: UpdateEventoEmbudoVentasDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    const conclusionEvento = dto.conclusionEvento.trim();
    try {
      const evento = await this.eventosRepository.findOne({
        where: { id: idEvento },
      });
      if (!evento) {
        throw new NotFoundException(
          `El evento con ID: ${idEvento} no fue encontrado.`,
        );
      }

      const embudo = await this.embudoRepository.findOne({
        where: { id: evento.idEmbudoVentas },
      });
      if (!embudo) {
        throw new NotFoundException(
          `El embudo de ventas del evento ${idEvento} no fue encontrado.`,
        );
      }

      if (Number(embudo.idUsuario) !== Number(idUser)) {
        throw new ForbiddenException(
          "Solo el usuario asignado al embudo puede actualizar el evento.",
        );
      }

      const estatusRealizada = 1;
      await this.dataSource.transaction(async (manager) => {
        await manager.update(EventosEmbudoVentas, idEvento, {
          conclusionEvento,
          estatus: estatusRealizada,
        });
        await manager.update(EmbudoVentas, embudo.id, {
          fhUpdate: new Date(),
        });
      });

      await this.bitacoraLogger.logToBitacora(
        "EmbudoVentas",
        `Conclusión registrada en el evento ${idEvento} del embudo ${Number(embudo.id)}. El evento quedó como realizada.`,
        "UPDATE",
        {
          idEvento,
          idEmbudoVentas: Number(embudo.id),
          idUsuario: idUser,
          conclusionEvento,
          estatusAnterior: Number(evento.estatus),
          estatus: estatusRealizada,
        },
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: "success",
        message: "La conclusión del evento se registró y el evento quedó como realizada.",
        estatus: { estatus: estatusRealizada },
        data: {
          id: idEvento,
          nombre: MEDIO_COMUNICACION[Number(evento.medioComunicacion)] ?? "Evento",
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        "EmbudoVentas",
        `Error al registrar la conclusión del evento ${idEvento}.`,
        "UPDATE",
        { idEvento, idUsuario: idUser, conclusionEvento },
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: `Error al actualizar el evento con ID: ${idEvento}.`,
        error: error.message,
      });
    }
  }

  async updateEstatusEvento(
    idEvento: number,
    estatus: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const evento = await this.eventosRepository.findOne({
        where: { id: idEvento },
      });
      if (!evento) {
        throw new NotFoundException(
          `El evento con ID: ${idEvento} no fue encontrado.`,
        );
      }

      const embudo = await this.embudoRepository.findOne({
        where: { id: evento.idEmbudoVentas },
      });
      if (!embudo) {
        throw new NotFoundException(
          `El embudo de ventas del evento ${idEvento} no fue encontrado.`,
        );
      }

      if (Number(embudo.idUsuario) !== Number(idUser)) {
        throw new ForbiddenException(
          "Solo el usuario asignado al embudo puede actualizar el estatus del evento.",
        );
      }

      const estatusAnterior = Number(evento.estatus);
      await this.dataSource.transaction(async (manager) => {
        await manager.update(EventosEmbudoVentas, idEvento, { estatus });
        await manager.update(EmbudoVentas, embudo.id, {
          fhUpdate: new Date(),
        });
      });

      await this.bitacoraLogger.logToBitacora(
        "EmbudoVentas",
        `Estatus del evento ${idEvento} del embudo ${Number(embudo.id)} actualizado de ${estatusAnterior} a ${estatus}.`,
        "UPDATE",
        {
          idEvento,
          idEmbudoVentas: Number(embudo.id),
          idUsuario: idUser,
          estatusAnterior,
          estatus,
        },
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: "success",
        message: "El estatus del evento se actualizó correctamente.",
        estatus: { estatus },
        data: {
          id: idEvento,
          nombre: MEDIO_COMUNICACION[Number(evento.medioComunicacion)] ?? "Evento",
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        "EmbudoVentas",
        `Error al actualizar el estatus del evento ${idEvento}.`,
        "UPDATE",
        { idEvento, idUsuario: idUser, estatus },
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: `Error al actualizar el estatus del evento con ID: ${idEvento}.`,
        error: error.message,
      });
    }
  }

  async updateEstatusEmbudo(
    id: number,
    estatus: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const embudo = await this.embudoRepository.findOne({ where: { id } });
      if (!embudo) {
        throw new NotFoundException(
          `El embudo de ventas con ID: ${id} no fue encontrado.`,
        );
      }

      if (Number(embudo.idUsuario) !== Number(idUser)) {
        throw new ForbiddenException(
          "Solo el usuario asignado al embudo puede actualizar su estatus.",
        );
      }

      const estatusAnterior = Number(embudo.estatus);
      await this.embudoRepository.update(id, {
        estatus,
        fhUpdate: new Date(),
      });

      await this.bitacoraLogger.logToBitacora(
        "EmbudoVentas",
        `Estatus del embudo ${id} actualizado de ${estatusAnterior} a ${estatus}.`,
        "UPDATE",
        { id, idUsuario: idUser, estatusAnterior, estatus },
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: "success",
        message: "El estatus del embudo se actualizó correctamente.",
        estatus: { estatus },
        data: {
          id,
          nombre: `Embudo ${id}`,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        "EmbudoVentas",
        `Error al actualizar el estatus del embudo ${id}.`,
        "UPDATE",
        { id, idUsuario: idUser, estatus },
        idUser,
        ID_MODULE,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: `Error al actualizar el estatus del embudo con ID: ${id}.`,
        error: error.message,
      });
    }
  }

  listMediosComunicacion(): ApiResponseCommon {
    return {
      data: Object.entries(MEDIO_COMUNICACION).map(([id, nombre]) => ({
        id: Number(id),
        nombre,
      })),
    };
  }

  async getAllEmbudos(
    idUsuario: number,
    cliente: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    try {
      const params: number[] = [];
      let filtroRol = "";

      if (this.esVendedor(rol)) {
        filtroRol = "WHERE e.IdUsuario = ?";
        params.push(idUsuario);
      } else if (!isSuperAdmin(rol)) {
        filtroRol = "WHERE (c.Id = ? OR c.IdPadre = ?)";
        params.push(cliente, cliente);
      }

      const rows: EmbudoVentas[] = await this.embudoRepository.query(
        `
SELECT
  e.Id AS id,
  e.IdUsuario AS idUsuario,
  e.IdCliente AS idCliente,
  e.FHRegistro AS fhRegistro,
  e.FHUpdate AS fhUpdate,
  e.Estatus AS estatus
FROM EmbudoVentas e
INNER JOIN Clientes c ON c.Id = e.IdCliente
${filtroRol}
ORDER BY e.Id DESC;
        `,
        params,
      );

      const ids = rows.map((row) => Number(row.id));
      const eventos = ids.length
        ? await this.eventosRepository.find({
            where: { idEmbudoVentas: In(ids) },
            order: { id: "ASC" },
          })
        : [];

      return {
        data: rows.map((row) =>
          this.mapEmbudo(
            row,
            eventos.filter(
              (evento) => Number(evento.idEmbudoVentas) === Number(row.id),
            ),
          ),
        ),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException({
        message: "Ocurrió un error al obtener los embudos de venta.",
      });
    }
  }

  async getOneEmbudo(
    id: number,
    idUsuario: number,
    cliente: number,
    rol: number,
  ) {
    try {
      const embudo = await this.obtenerEmbudoAccesible(
        id,
        idUsuario,
        cliente,
        rol,
      );
      const eventos = await this.eventosRepository.find({
        where: { idEmbudoVentas: id },
        order: { id: "ASC" },
      });
      return { data: this.mapEmbudo(embudo, eventos) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException({
        message: `Error al obtener el embudo de ventas con ID: ${id}.`,
      });
    }
  }

  private esVendedor(rol: number): boolean {
    return Number(rol) === ROL_VENDEDOR;
  }

  private async obtenerEmbudoAccesible(
    id: number,
    idUsuario: number,
    cliente: number,
    rol: number,
  ): Promise<EmbudoVentas> {
    const embudo = await this.embudoRepository.findOne({ where: { id } });
    if (!embudo) {
      throw new NotFoundException(
        `El embudo de ventas con ID: ${id} no fue encontrado.`,
      );
    }

    if (this.esVendedor(rol)) {
      if (Number(embudo.idUsuario) !== Number(idUsuario)) {
        throw new NotFoundException(
          `El embudo de ventas con ID: ${id} no fue encontrado.`,
        );
      }
      return embudo;
    }

    if (!isSuperAdmin(rol)) {
      const rows = await this.clientesRepository.query(
        `
SELECT Id
FROM Clientes
WHERE Id = ?
  AND (Id = ? OR IdPadre = ?)
        `,
        [embudo.idCliente, cliente, cliente],
      );
      if (!rows.length) {
        throw new NotFoundException(
          `El embudo de ventas con ID: ${id} no fue encontrado.`,
        );
      }
    }

    return embudo;
  }

  private mapEmbudo(
    embudo: EmbudoVentas,
    eventos: EventosEmbudoVentas[],
  ) {
    return {
      id: Number(embudo.id),
      idUsuario: Number(embudo.idUsuario),
      idCliente: Number(embudo.idCliente),
      fhRegistro: embudo.fhRegistro,
      fhUpdate: embudo.fhUpdate,
      estatus: Number(embudo.estatus),
      eventos: eventos.map((evento) => ({
        id: Number(evento.id),
        idEmbudoVentas: Number(evento.idEmbudoVentas),
        fhProximoEvento: evento.fhProximoEvento,
        medioComunicacion: Number(evento.medioComunicacion),
        estatus: Number(evento.estatus),
        comentario: evento.comentario ?? null,
        conclusionEvento: evento.conclusionEvento ?? null,
      })),
    };
  }
}
