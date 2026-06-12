import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BitacoraService } from "src/bitacora/bitacora.service";
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from "src/common/ApiResponse";
import { Inpc } from "src/entities/Inpc";
import { Repository } from "typeorm";
import { CreateInpcDto } from "./dto/create-inpc.dto";
import { InpcUnificadoItemDto } from "./dto/inpc-unificado-item.dto";
import { UpdateInpcDto } from "./dto/update-inpc.dto";
import { BanxicoClientService } from "./services/banxico-client.service";

function decStr(v: number | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  return String(v);
}

function parseAnioMes(dateStr: string): { anio: number; mes: number } {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(
      "fechaInicio y fechaFin deben ser fechas válidas (YYYY-MM-DD).",
    );
  }
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}

function anioMesKey(anio: number, mes: number): number {
  return anio * 100 + mes;
}

@Injectable()
export class InpcService {
  private readonly logger = new Logger(InpcService.name);

  constructor(
    @InjectRepository(Inpc)
    private readonly inpcRepository: Repository<Inpc>,
    private readonly bitacoraLogger: BitacoraService,
    private readonly banxicoClient: BanxicoClientService,
  ) {}

  async create(dto: CreateInpcDto, req: any) {
    await this.assertUniqueAnioMes(dto.anio, dto.mes);

    const row = this.inpcRepository.create({
      anio: dto.anio,
      mes: dto.mes,
      inpc: String(dto.inpc),
      porcentajeAnual: decStr(dto.porcentajeAnual),
      estatus: 1,
    });
    const saved = await this.inpcRepository.save(row);

    await this.logBitacora(
      req,
      "CREATE",
      `INPC creado: ${saved.anio}/${saved.mes} = ${saved.inpc}.`,
      { dto },
    );

    return this.crudSuccess(
      "El registro INPC ha sido creado correctamente.",
      saved,
    );
  }

  async findOne(id: number) {
    const data = await this.inpcRepository.findOne({ where: { id } });
    if (!data) {
      throw new NotFoundException("Registro INPC no encontrado");
    }
    return data;
  }

  async findAllPaginated(
    page: number,
    limit: number,
    fechaInicio?: string,
    fechaFin?: string,
  ): Promise<ApiResponseCommon> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);

    if (!fechaInicio || !fechaFin) {
      if (fechaInicio || fechaFin) {
        throw new BadRequestException(
          "Debe enviar fechaInicio y fechaFin juntas.",
        );
      }
      const skip = (safePage - 1) * safeLimit;
      const [data, total] = await this.inpcRepository.findAndCount({
        skip,
        take: safeLimit,
        order: { anio: "DESC", mes: "DESC", id: "DESC" },
      });

      return {
        data,
        paginated: {
          total,
          page: safePage,
          lastPage: total === 0 ? 0 : Math.ceil(total / safeLimit),
        },
      };
    }

    const inicio = parseAnioMes(fechaInicio);
    const fin = parseAnioMes(fechaFin);
    if (anioMesKey(inicio.anio, inicio.mes) > anioMesKey(fin.anio, fin.mes)) {
      throw new BadRequestException(
        "fechaInicio no puede ser posterior a fechaFin.",
      );
    }

    const locales = await this.queryLocalesEnRango(inicio, fin);

    let banxicoDatos: InpcUnificadoItemDto[] = [];
    if (this.banxicoClient.isConfigured()) {
      try {
        const banxico = await this.banxicoClient.consultarSerieRango(
          fechaInicio,
          fechaFin,
        );
        banxicoDatos = banxico.datos.map((d) => {
          const date = this.banxicoClient.parseFechaBanxico(d.fecha);
          return {
            isBanxico: true,
            anio: date.getFullYear(),
            mes: date.getMonth() + 1,
            inpc: d.indice,
            porcentajeAnual: d.porcAnual,
            porcAcumAnual: d.porcAcumAnual,
          };
        });
      } catch (err) {
        this.logger.warn(
          `No se pudo consultar Banxico: ${
            err instanceof Error ? err.message : err
          }`,
        );
        banxicoDatos = [];
      }
    }

    const merged = this.mergeInpcItems(locales, banxicoDatos);
    const total = merged.length;
    const skip = (safePage - 1) * safeLimit;
    const data = merged.slice(skip, skip + safeLimit);

    return {
      data,
      paginated: {
        total,
        page: safePage,
        lastPage: total === 0 ? 0 : Math.ceil(total / safeLimit),
      },
    };
  }

  async update(id: number, dto: UpdateInpcDto, req: any) {
    const current = await this.findOne(id);

    const anio = dto.anio ?? current.anio;
    const mes = dto.mes ?? current.mes;
    if (anio == null || mes == null) {
      throw new BadRequestException("Anio y mes son requeridos");
    }

    if (dto.anio !== undefined || dto.mes !== undefined) {
      await this.assertUniqueAnioMes(anio, mes, id);
    }

    const patch: Partial<Inpc> = {};
    if (dto.anio !== undefined) patch.anio = dto.anio;
    if (dto.mes !== undefined) patch.mes = dto.mes;
    if (dto.inpc !== undefined) patch.inpc = String(dto.inpc);
    if (dto.porcentajeAnual !== undefined) {
      patch.porcentajeAnual = decStr(dto.porcentajeAnual);
    }

    await this.inpcRepository.update(id, patch);
    const updated = await this.findOne(id);

    await this.logBitacora(
      req,
      "UPDATE",
      `INPC actualizado con id: ${id}.`,
      { dto },
    );

    return this.crudSuccess(
      "El registro INPC ha sido actualizado correctamente.",
      updated,
    );
  }

  async desactivar(id: number, req: any) {
    const current = await this.findOne(id);
    await this.inpcRepository.update(id, { estatus: 0 });

    await this.logBitacora(
      req,
      "UPDATE",
      `INPC dado de BAJA con id: ${id}.`,
      { id },
    );

    return this.crudSuccess(
      "El registro INPC ha sido dado de baja correctamente.",
      current,
    );
  }

  async activar(id: number, req: any) {
    const current = await this.findOne(id);

    if (current.anio != null && current.mes != null) {
      await this.assertUniqueAnioMes(current.anio, current.mes, id);
    }

    await this.inpcRepository.update(id, { estatus: 1 });

    await this.logBitacora(
      req,
      "UPDATE",
      `INPC dado de ALTA con id: ${id}.`,
      { id },
    );

    return this.crudSuccess(
      "El registro INPC ha sido dado de alta correctamente.",
      current,
    );
  }

  private async queryLocalesEnRango(
    inicio: { anio: number; mes: number },
    fin: { anio: number; mes: number },
  ): Promise<Inpc[]> {
    const start = anioMesKey(inicio.anio, inicio.mes);
    const end = anioMesKey(fin.anio, fin.mes);

    return this.inpcRepository
      .createQueryBuilder("i")
      .where("(i.anio * 100 + i.mes) >= :start", { start })
      .andWhere("(i.anio * 100 + i.mes) <= :end", { end })
      .orderBy("i.anio", "DESC")
      .addOrderBy("i.mes", "DESC")
      .addOrderBy("i.id", "DESC")
      .getMany();
  }

  private mergeInpcItems(
    locales: Inpc[],
    banxico: InpcUnificadoItemDto[],
  ): InpcUnificadoItemDto[] {
    const localItems: InpcUnificadoItemDto[] = locales
      .filter((row) => row.anio != null && row.mes != null)
      .map((row) => ({
        isBanxico: false,
        id: row.id,
        anio: row.anio!,
        mes: row.mes!,
        inpc: row.inpc,
        porcentajeAnual: row.porcentajeAnual,
        fhRegistro: row.fhRegistro,
        estatus: row.estatus,
      }));

    return [...localItems, ...banxico].sort((a, b) => {
      const diff = anioMesKey(b.anio, b.mes) - anioMesKey(a.anio, a.mes);
      if (diff !== 0) return diff;
      return Number(a.isBanxico) - Number(b.isBanxico);
    });
  }

  private async assertUniqueAnioMes(
    anio: number,
    mes: number,
    excludeId?: number,
  ) {
    const qb = this.inpcRepository
      .createQueryBuilder("i")
      .where("i.anio = :anio", { anio })
      .andWhere("i.mes = :mes", { mes })
      .andWhere("i.estatus = 1");

    if (excludeId != null) {
      qb.andWhere("i.id != :excludeId", { excludeId });
    }

    const exist = await qb.getOne();
    if (exist) {
      throw new ConflictException(
        `Ya existe un INPC activo para ${anio}/${mes}`,
      );
    }
  }

  private crudSuccess(message: string, saved: Inpc): ApiCrudResponse {
    return {
      status: "success",
      message,
      data: {
        id: saved.id,
        nombre: `${saved.anio}/${saved.mes}`,
      },
    };
  }

  private async logBitacora(
    req: any,
    action: string,
    message: string,
    payload: object,
  ) {
    const idUser = Number(req?.user?.userId || 0);
    await this.bitacoraLogger.logToBitacora(
      "INPC",
      message,
      action,
      payload,
      idUser,
      1,
      EstatusEnumBitcora.SUCCESS,
    );
  }
}
