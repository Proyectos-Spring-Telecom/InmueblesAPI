import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApiResponseCommon } from "src/common/ApiResponse";
import {
  PAGO_MENSUAL_RELATIONS,
  parseRangoFechas,
} from "src/common/pago-mensual.utils";
import { HistoricoPagosMantenimiento } from "src/entities/HistoricoPagosMantenimiento";

export interface HistoricoPagosMantenimientoFilters {
  fechaInicio: string;
  fechaFin: string;
  idArrendatario?: number;
  idContrato?: number;
}

@Injectable()
export class HistoricoPagosMantenimientoService {
  constructor(
    @InjectRepository(HistoricoPagosMantenimiento)
    private readonly historicoRepository: Repository<HistoricoPagosMantenimiento>,
  ) {}

  async findOne(id: number) {
    const data = await this.historicoRepository.findOne({
      where: { id },
      relations: [...PAGO_MENSUAL_RELATIONS],
    });
    if (!data) {
      throw new NotFoundException(
        `Histórico de pago de mantenimiento con id ${id} no encontrado.`,
      );
    }
    return data;
  }

  async findAllPaginated(
    page: number,
    limit: number,
    filters: HistoricoPagosMantenimientoFilters,
  ): Promise<ApiResponseCommon> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const skip = (safePage - 1) * safeLimit;
    const { inicio, fin } = parseRangoFechas(
      filters.fechaInicio,
      filters.fechaFin,
    );

    const qb = this.historicoRepository
      .createQueryBuilder("h")
      .leftJoinAndSelect("h.arrendatario", "arrendatario")
      .leftJoinAndSelect("h.contrato", "contrato")
      .leftJoinAndSelect("contrato.inmueble", "inmueble")
      .leftJoinAndSelect("contrato.contratoLocales", "contratoLocales")
      .leftJoinAndSelect("contratoLocales.local", "local")
      .leftJoinAndSelect("h.formula", "formula")
      .where("h.mes >= :inicio", { inicio })
      .andWhere("h.mes <= :fin", { fin });

    if (filters.idArrendatario != null) {
      qb.andWhere("h.idArrendatario = :idArrendatario", {
        idArrendatario: filters.idArrendatario,
      });
    }
    if (filters.idContrato != null) {
      qb.andWhere("h.idContrato = :idContrato", {
        idContrato: filters.idContrato,
      });
    }

    const total = await qb.getCount();

    const data = await qb
      .orderBy("h.mes", "DESC")
      .addOrderBy("h.id", "DESC")
      .skip(skip)
      .take(safeLimit)
      .getMany();

    return {
      data,
      paginated: {
        total,
        page: safePage,
        lastPage: total === 0 ? 0 : Math.ceil(total / safeLimit),
      },
    };
  }

  assertOptionalInt(value: string | undefined, field: string): number | undefined {
    if (value === undefined || value === "") return undefined;
    const n = Number(value);
    if (!Number.isInteger(n)) {
      throw new BadRequestException(`${field} debe ser un entero válido.`);
    }
    return n;
  }
}
