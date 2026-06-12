import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApiResponseCommon } from "src/common/ApiResponse";
import {
  decStr,
  mapPagoRentaDesglose,
  PAGO_MENSUAL_RELATIONS,
  parseRangoFechas,
} from "src/common/pago-mensual.utils";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Formulas } from "src/entities/Formulas";
import { HistoricoPagosRenta } from "src/entities/HistoricoPagosRenta";
import { CreateHistoricoPagoRentaDto } from "./dto/create-historico-pago-renta.dto";
import { UpdateHistoricoPagoRentaDto } from "./dto/update-historico-pago-renta.dto";

export interface HistoricoPagosRentaFilters {
  fechaInicio: string;
  fechaFin: string;
  idArrendatario?: number;
  idContrato?: number;
}

@Injectable()
export class HistoricoPagosRentaService {
  constructor(
    @InjectRepository(HistoricoPagosRenta)
    private readonly historicoRepository: Repository<HistoricoPagosRenta>,
    @InjectRepository(Arrendatarios)
    private readonly arrendatariosRepository: Repository<Arrendatarios>,
    @InjectRepository(ContratoArrendatarios)
    private readonly contratoRepository: Repository<ContratoArrendatarios>,
    @InjectRepository(Formulas)
    private readonly formulasRepository: Repository<Formulas>,
  ) {}

  async create(dto: CreateHistoricoPagoRentaDto) {
    await this.assertArrendatario(dto.idArrendatario);
    await this.assertContrato(dto.idContrato, dto.idArrendatario);
    await this.assertFormula(dto.idFormula);

    const row = this.historicoRepository.create({
      idArrendatario: dto.idArrendatario,
      idContrato: dto.idContrato,
      mes: new Date(dto.mes),
      total: decStr(dto.total),
      idFormula: dto.idFormula ?? null,
      montoFinal: decStr(dto.montoFinal),
      totalMantenimiento: decStr(dto.totalMantenimiento),
      montoFinalMantenimiento: decStr(dto.montoFinalMantenimiento),
      factorVariable: decStr(dto.factorVariable),
      ocupoFormula: dto.ocupoFormula ?? null,
      pagada: dto.pagada ?? 1,
    });

    const saved = await this.historicoRepository.save(row);
    return {
      status: "success",
      message: "Histórico de pago de renta registrado correctamente.",
      data: await this.findOne(Number(saved.id)),
    };
  }

  async update(id: number, dto: UpdateHistoricoPagoRentaDto) {
    const current = await this.historicoRepository.findOne({
      where: { id },
      select: ["id", "idArrendatario"],
    });
    if (!current) {
      throw new NotFoundException(
        `Histórico de pago de renta con id ${id} no encontrado.`,
      );
    }

    const idArrendatario = dto.idArrendatario ?? Number(current.idArrendatario);

    if (dto.idArrendatario !== undefined) {
      await this.assertArrendatario(dto.idArrendatario);
    }
    if (dto.idContrato !== undefined) {
      await this.assertContrato(dto.idContrato, idArrendatario);
    }
    if (dto.idFormula !== undefined) {
      await this.assertFormula(dto.idFormula);
    }

    await this.historicoRepository.update(id, {
      ...(dto.idArrendatario !== undefined && {
        idArrendatario: dto.idArrendatario,
      }),
      ...(dto.idContrato !== undefined && {
        idContrato: dto.idContrato ?? null,
      }),
      ...(dto.mes !== undefined && { mes: new Date(dto.mes) }),
      ...(dto.total !== undefined && { total: decStr(dto.total) }),
      ...(dto.idFormula !== undefined && {
        idFormula: dto.idFormula ?? null,
      }),
      ...(dto.montoFinal !== undefined && {
        montoFinal: decStr(dto.montoFinal),
      }),
      ...(dto.totalMantenimiento !== undefined && {
        totalMantenimiento: decStr(dto.totalMantenimiento),
      }),
      ...(dto.montoFinalMantenimiento !== undefined && {
        montoFinalMantenimiento: decStr(dto.montoFinalMantenimiento),
      }),
      ...(dto.factorVariable !== undefined && {
        factorVariable: decStr(dto.factorVariable),
      }),
      ...(dto.ocupoFormula !== undefined && {
        ocupoFormula: dto.ocupoFormula ?? null,
      }),
      ...(dto.pagada !== undefined && { pagada: dto.pagada }),
    });

    return {
      status: "success",
      message: "Histórico de pago de renta actualizado correctamente.",
      data: await this.findOne(id),
    };
  }

  async findOne(id: number) {
    const data = await this.historicoRepository.findOne({
      where: { id },
      relations: [...PAGO_MENSUAL_RELATIONS],
    });
    if (!data) {
      throw new NotFoundException(
        `Histórico de pago de renta con id ${id} no encontrado.`,
      );
    }
    return mapPagoRentaDesglose(data);
  }

  async findAllPaginated(
    page: number,
    limit: number,
    filters: HistoricoPagosRentaFilters,
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
      data: data.map(mapPagoRentaDesglose),
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

  private async assertArrendatario(idArrendatario: number) {
    const row = await this.arrendatariosRepository.findOne({
      where: { id: idArrendatario },
      select: ["id"],
    });
    if (!row) {
      throw new NotFoundException(
        `Arrendatario con id ${idArrendatario} no encontrado.`,
      );
    }
  }

  private async assertContrato(idContrato: number, idArrendatario: number) {
    const contrato = await this.contratoRepository.findOne({
      where: { id: idContrato },
      select: ["id", "idArrendatario"],
    });
    if (!contrato) {
      throw new NotFoundException(`Contrato con id ${idContrato} no encontrado.`);
    }
    if (Number(contrato.idArrendatario) !== idArrendatario) {
      throw new BadRequestException(
        `El contrato ${idContrato} no pertenece al arrendatario ${idArrendatario}.`,
      );
    }
  }

  private async assertFormula(idFormula: number | undefined) {
    if (idFormula == null) return;

    const formula = await this.formulasRepository.findOne({
      where: { id: idFormula },
      select: ["id"],
    });
    if (!formula) {
      throw new NotFoundException(`Fórmula con id ${idFormula} no encontrada.`);
    }
  }
}
