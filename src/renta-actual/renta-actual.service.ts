import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, Repository } from "typeorm";
import { ApiResponseCommon } from "src/common/ApiResponse";
import { findContratoActivo } from "src/common/contrato-validation";
import {
  addOneMonth,
  decStr,
  getMesActual,
  isMesActual,
  mapPagoRentaDesglose,
  PAGO_MENSUAL_RELATIONS,
} from "src/common/pago-mensual.utils";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Formulas } from "src/entities/Formulas";
import { HistoricoPagosRenta } from "src/entities/HistoricoPagosRenta";
import { RentaActual } from "src/entities/RentaActual";
import { getClienteHijos, isSuperAdmin } from "src/utils/cliente-utils";
import { CreateRentaActualDto } from "./dto/create-renta-actual.dto";
import { UpdateRentaActualDto } from "./dto/update-renta-actual.dto";

@Injectable()
export class RentaActualService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(RentaActual)
    private readonly rentaActualRepository: Repository<RentaActual>,
    @InjectRepository(Arrendatarios)
    private readonly arrendatariosRepository: Repository<Arrendatarios>,
    @InjectRepository(ContratoArrendatarios)
    private readonly contratoRepository: Repository<ContratoArrendatarios>,
    @InjectRepository(Formulas)
    private readonly formulasRepository: Repository<Formulas>,
  ) {}

  async create(dto: CreateRentaActualDto) {
    await this.assertArrendatario(dto.idArrendatario);
    await this.assertContrato(dto.idContrato, dto.idArrendatario);
    await this.assertFormula(dto.idFormula);
    await this.assertNoRegistroActivo(dto.idArrendatario, dto.idContrato);

    const row = this.rentaActualRepository.create({
      idArrendatario: dto.idArrendatario,
      idContrato: dto.idContrato,
      mes: getMesActual(),
      total: decStr(dto.total),
      idFormula: dto.idFormula ?? null,
      montoFinal: decStr(dto.montoFinal),
      totalMantenimiento: decStr(dto.totalMantenimiento),
      montoFinalMantenimiento: decStr(dto.montoFinalMantenimiento),
      factorVariable: decStr(dto.factorVariable),
      ocupoFormula: dto.ocupoFormula ?? null,
      pagada: 0,
    });

    const saved = await this.rentaActualRepository.save(row);
    return {
      status: "success",
      message: "Renta actual registrada correctamente.",
      data: await this.findOne(Number(saved.id)),
    };
  }

  async duplicarSiguienteMes(id: number) {
    const source = await this.rentaActualRepository.findOne({ where: { id } });
    if (!source) {
      throw new NotFoundException(`Renta actual con id ${id} no encontrada.`);
    }
    if (!source.mes) {
      throw new BadRequestException(
        `La renta actual con id ${id} no tiene Mes definido.`,
      );
    }
    if (source.idArrendatario == null || source.idContrato == null) {
      throw new BadRequestException(
        `La renta actual con id ${id} no tiene arrendatario o contrato.`,
      );
    }

    await this.assertContrato(
      Number(source.idContrato),
      Number(source.idArrendatario),
    );

    const mesSiguiente = addOneMonth(source.mes);
    await this.assertNoRegistroEnMes(
      Number(source.idArrendatario),
      Number(source.idContrato),
      mesSiguiente,
    );

    const row = this.rentaActualRepository.create({
      idArrendatario: source.idArrendatario,
      idContrato: source.idContrato,
      mes: mesSiguiente,
      total: source.total,
      idFormula: source.idFormula,
      montoFinal: source.montoFinal,
      totalMantenimiento: source.totalMantenimiento,
      montoFinalMantenimiento: source.montoFinalMantenimiento,
      factorVariable: source.factorVariable,
      ocupoFormula: source.ocupoFormula,
      pagada: source.pagada,
    });

    const saved = await this.rentaActualRepository.save(row);
    return {
      status: "success",
      message: "Renta actual duplicada al mes siguiente correctamente.",
      data: await this.findOne(Number(saved.id)),
    };
  }

  async update(id: number, dto: UpdateRentaActualDto) {
    const current = await this.rentaActualRepository.findOne({
      where: { id },
    });
    if (!current) {
      throw new NotFoundException(`Renta actual con id ${id} no encontrada.`);
    }

    if (current.idContrato != null && current.idArrendatario != null) {
      await findContratoActivo(
        this.contratoRepository,
        Number(current.idContrato),
        Number(current.idArrendatario),
      );
    }

    if (dto.idFormula !== undefined) {
      await this.assertFormula(dto.idFormula);
    }

    await this.rentaActualRepository.update(id, {
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
    });

    return {
      status: "success",
      message: "Renta actual actualizada correctamente.",
      data: await this.findOne(id),
    };
  }

  async marcarPagada(id: number) {
    return this.dataSource.transaction(async (manager) => {
      const row = await manager.findOne(RentaActual, { where: { id } });
      if (!row) {
        throw new NotFoundException(`Renta actual con id ${id} no encontrada.`);
      }

      if (row.idContrato != null && row.idArrendatario != null) {
        await findContratoActivo(
          this.contratoRepository,
          Number(row.idContrato),
          Number(row.idArrendatario),
        );
      }

      if (Number(row.pagada) === 1) {
        throw new BadRequestException("La renta ya está marcada como pagada.");
      }

      const savedHistorico = await this.ensureHistoricoPagada(manager, row);

      const esMesActual = isMesActual(row.mes);

      if (esMesActual) {
        await manager.update(RentaActual, id, { pagada: 1 });

        const data = await manager.findOne(RentaActual, {
          where: { id },
          relations: [...PAGO_MENSUAL_RELATIONS],
        });

        return {
          status: "success",
          message:
            "Renta del mes actual marcada como pagada. El registro permanece en RentaActual.",
          data: data ? mapPagoRentaDesglose(data) : null,
        };
      }

      await manager.delete(RentaActual, id);

      const data = await manager.findOne(HistoricoPagosRenta, {
        where: { id: savedHistorico.id },
        relations: [...PAGO_MENSUAL_RELATIONS],
      });

      return {
        status: "success",
        message:
          "Renta de mes anterior marcada como pagada y movida al histórico.",
        data: data ? mapPagoRentaDesglose(data) : null,
      };
    });
  }

  /**
   * Rentas pagadas en el mes en que se registraron permanecen en RentaActual hasta
   * que cambia el mes. Este job las pasa a histórico (si aún no están) y las elimina.
   */
  async archivarRentasPagadasMesesAnteriores(): Promise<{ archivadas: number }> {
    const mesActual = getMesActual();
    const anio = mesActual.getFullYear();
    const mes = mesActual.getMonth() + 1;

    const rows = await this.rentaActualRepository
      .createQueryBuilder("r")
      .where("r.pagada = :pagada", { pagada: 1 })
      .andWhere(
        "(YEAR(r.mes) < :anio OR (YEAR(r.mes) = :anio AND MONTH(r.mes) < :mes))",
        { anio, mes },
      )
      .getMany();

    if (rows.length === 0) {
      return { archivadas: 0 };
    }

    await this.dataSource.transaction(async (manager) => {
      for (const row of rows) {
        await this.ensureHistoricoPagada(manager, row);
        await manager.delete(RentaActual, row.id);
      }
    });

    return { archivadas: rows.length };
  }

  async findOne(id: number) {
    const data = await this.rentaActualRepository.findOne({
      where: { id },
      relations: [...PAGO_MENSUAL_RELATIONS],
    });
    if (!data) {
      throw new NotFoundException(`Renta actual con id ${id} no encontrada.`);
    }
    return mapPagoRentaDesglose(data);
  }

  async findAllPaginated(
    page: number,
    limit: number,
    idCliente: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const skip = (safePage - 1) * safeLimit;

    let arrendadorIds: number[] | null = null;
    if (!isSuperAdmin(rol)) {
      const scope = await getClienteHijos(
        this.arrendatariosRepository,
        idCliente,
      );
      if (scope.ids.length === 0) {
        return {
          data: [],
          paginated: {
            total: 0,
            page: safePage,
            lastPage: 0,
          },
        };
      }
      arrendadorIds = scope.ids;
    }

    const qb = this.rentaActualRepository
      .createQueryBuilder("r")
      .leftJoin("r.arrendatario", "arrendatario");

    if (arrendadorIds) {
      qb.where("arrendatario.idArrendador IN (:...arrendadorIds)", {
        arrendadorIds,
      });
    }

    const total = await qb.getCount();

    const idRows = await qb
      .select("r.id", "id")
      .orderBy("r.id", "DESC")
      .skip(skip)
      .take(safeLimit)
      .getRawMany<{ id: string }>();

    if (idRows.length === 0) {
      return {
        data: [],
        paginated: {
          total,
          page: safePage,
          lastPage: total === 0 ? 0 : Math.ceil(total / safeLimit),
        },
      };
    }

    const ids = idRows.map((r) => Number(r.id));
    const data = await this.rentaActualRepository.find({
      where: { id: In(ids) },
      relations: [...PAGO_MENSUAL_RELATIONS],
      order: { id: "DESC" },
    });

    return {
      data: data.map(mapPagoRentaDesglose),
      paginated: {
        total,
        page: safePage,
        lastPage: Math.ceil(total / safeLimit),
      },
    };
  }

  private async assertNoRegistroActivo(
    idArrendatario: number,
    idContrato: number,
  ) {
    await this.assertNoRegistroEnMes(
      idArrendatario,
      idContrato,
      getMesActual(),
      `Ya existe una renta actual para el mes en curso (arrendatario ${idArrendatario}, contrato ${idContrato}).`,
    );
  }

  private async assertNoRegistroEnMes(
    idArrendatario: number,
    idContrato: number,
    mes: Date,
    message?: string,
  ) {
    const existing = await this.rentaActualRepository
      .createQueryBuilder("r")
      .where("r.idArrendatario = :idArrendatario", { idArrendatario })
      .andWhere("r.idContrato = :idContrato", { idContrato })
      .andWhere("YEAR(r.mes) = :anio", { anio: mes.getFullYear() })
      .andWhere("MONTH(r.mes) = :mesNum", { mesNum: mes.getMonth() + 1 })
      .select(["r.id"])
      .getOne();

    if (existing) {
      throw new ConflictException(
        message ??
          `Ya existe una renta actual para el mes ${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, "0")} (arrendatario ${idArrendatario}, contrato ${idContrato}).`,
      );
    }
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
    await findContratoActivo(
      this.contratoRepository,
      idContrato,
      idArrendatario,
    );
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

  private async ensureHistoricoPagada(
    manager: EntityManager,
    row: RentaActual,
  ): Promise<HistoricoPagosRenta> {
    const existing = await manager
      .createQueryBuilder(HistoricoPagosRenta, "h")
      .where("h.idArrendatario = :idArrendatario", {
        idArrendatario: row.idArrendatario,
      })
      .andWhere("h.idContrato = :idContrato", { idContrato: row.idContrato })
      .andWhere("YEAR(h.mes) = YEAR(:mes)", { mes: row.mes })
      .andWhere("MONTH(h.mes) = MONTH(:mes)", { mes: row.mes })
      .andWhere("h.pagada = :pagada", { pagada: 1 })
      .getOne();

    if (existing) {
      return existing;
    }

    const historico = manager.create(HistoricoPagosRenta, {
      idArrendatario: row.idArrendatario,
      idContrato: row.idContrato,
      mes: row.mes,
      total: row.total,
      idFormula: row.idFormula,
      montoFinal: row.montoFinal,
      totalMantenimiento: row.totalMantenimiento,
      montoFinalMantenimiento: row.montoFinalMantenimiento,
      factorVariable: row.factorVariable,
      ocupoFormula: row.ocupoFormula,
      pagada: 1,
    });

    return manager.save(HistoricoPagosRenta, historico);
  }
}
