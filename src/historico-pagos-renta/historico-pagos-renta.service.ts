import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, DataSource, Repository } from "typeorm";
import { ApiResponseCommon } from "src/common/ApiResponse";
import {
  mapHistoricoPagoRentaResponse,
  mapPagoRentaDesglose,
  parseRangoMeses,
  sqlMesEnRango,
} from "src/common/pago-mensual.utils";
import { CARGO_RENTA_RELATIONS, RentaLegacy, toRentaLegacy } from "src/cobranza/cobranza-legacy";
import { CobranzaService } from "src/cobranza/cobranza.service";
import { Cargos } from "src/entities/Cargos";
import { conceptosDeRenta, RentaActualService } from "src/renta-actual/renta-actual.service";
import { Arrendadores } from "src/entities/Arrendadores";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Formulas } from "src/entities/Formulas";
import { getClienteHijos, isSuperAdmin } from "src/utils/cliente-utils";
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
    private readonly dataSource: DataSource,
    @InjectRepository(Cargos)
    private readonly cargosRepository: Repository<Cargos>,
    @InjectRepository(Arrendatarios)
    private readonly arrendatariosRepository: Repository<Arrendatarios>,
    @InjectRepository(Arrendadores)
    private readonly arrendadoresRepository: Repository<Arrendadores>,
    @InjectRepository(ContratoArrendatarios)
    private readonly contratoRepository: Repository<ContratoArrendatarios>,
    @InjectRepository(Formulas)
    private readonly formulasRepository: Repository<Formulas>,
    private readonly cobranza: CobranzaService,
    private readonly rentaActualService: RentaActualService,
  ) {}

  /**
   * Registra un mes de renta ya cobrado (captura histórica). Crea el cargo y, si viene
   * pagado (por defecto), un pago por el total con fecha del mes que cubre.
   */
  async create(dto: CreateHistoricoPagoRentaDto) {
    await this.assertArrendatario(dto.idArrendatario);
    await this.assertContrato(dto.idContrato, dto.idArrendatario);
    await this.assertFormula(dto.idFormula);

    const mes = new Date(dto.mes);
    const fechaFin =
      dto.fechaFin != null && String(dto.fechaFin).trim() !== ""
        ? new Date(dto.fechaFin)
        : null;

    const id = await this.dataSource.transaction(async (m) => {
      const idCargo = await this.cobranza.crearCargo(m, {
        idArrendatario: dto.idArrendatario,
        idContrato: dto.idContrato,
        clase: "RENTA",
        mes,
        fechaFin,
        idFormula: dto.idFormula ?? null,
        usaFormula: dto.usaFormula ?? null,
        ocupoFormula: dto.ocupoFormula ?? null,
        factorVariable: dto.factorVariable ?? null,
        origen: "HISTORICO",
        conceptos: conceptosDeRenta(dto),
      });
      if ((dto.pagada ?? 1) === 1) {
        await this.cobranza.liquidarCargo(m, idCargo, { fechaPago: mes, origen: "HISTORICO" });
      }
      return idCargo;
    });

    return {
      status: "success",
      message: "Histórico de pago de renta registrado correctamente.",
      data: await this.findOne(id),
    };
  }

  async update(id: number, dto: UpdateHistoricoPagoRentaDto) {
    const current = await this.cargosRepository.findOne({ where: { id, clase: "RENTA", estatus: 1 } });
    if (!current) {
      throw new NotFoundException(`Histórico de pago de renta con id ${id} no encontrado.`);
    }

    const idArrendatario = dto.idArrendatario ?? Number(current.idArrendatario);
    if (dto.idArrendatario !== undefined) {
      await this.assertArrendatario(dto.idArrendatario);
      if (dto.idArrendatario !== Number(current.idArrendatario) && Number(current.pagado) > 0) {
        throw new BadRequestException(
          "No se puede cambiar el arrendatario de un cargo con pagos aplicados; cancele los pagos primero.",
        );
      }
    }
    if (dto.idContrato !== undefined) {
      await this.assertContrato(dto.idContrato, idArrendatario);
    }
    if (dto.idFormula !== undefined) {
      await this.assertFormula(dto.idFormula);
    }

    await this.dataSource.transaction(async (m) => {
      await m.update(Cargos, id, {
        ...(dto.idArrendatario !== undefined && { idArrendatario: dto.idArrendatario }),
        ...(dto.idContrato !== undefined && { idContrato: dto.idContrato ?? null }),
        ...(dto.mes !== undefined && { mes: new Date(dto.mes) }),
      });
      await this.rentaActualService.aplicarCambiosCargo(m, id, dto);
      if (dto.pagada === 1) {
        const cargo = await m.findOne(Cargos, { where: { id } });
        if (cargo && Number(cargo.liquidado) !== 1) {
          await this.cobranza.liquidarCargo(m, id, { fechaPago: new Date(cargo.mes), origen: "HISTORICO" });
        }
      } else if (dto.pagada === 0) {
        // Desmarcar: las aplicaciones se anulan y el dinero queda como saldo a favor.
        await this.cobranza.anularAplicacionesDeCargo(m, id, null);
      }
    });

    return {
      status: "success",
      message: "Histórico de pago de renta actualizado correctamente.",
      data: await this.findOne(id),
    };
  }

  async findOne(id: number) {
    const data = await this.cargosRepository.findOne({
      where: { id, clase: "RENTA" },
      relations: [...CARGO_RENTA_RELATIONS],
    });
    if (!data) {
      throw new NotFoundException(`Histórico de pago de renta con id ${id} no encontrado.`);
    }
    const legacy = toRentaLegacy(data);
    const mesAnterior = await this.findRegistroMesAnterior(legacy);
    return mapHistoricoPagoRentaResponse(legacy, mesAnterior);
  }

  async findUltimo(idArrendatario: number, idContrato: number) {
    await this.assertArrendatario(idArrendatario);
    await this.assertContrato(idContrato, idArrendatario);

    const buscar = (liquidado: number) =>
      this.cargosRepository.findOne({
        where: { idArrendatario, idContrato, clase: "RENTA", estatus: 1, liquidado },
        relations: [...CARGO_RENTA_RELATIONS],
        order: { mes: "DESC", id: "DESC" },
      });

    const historico = await buscar(1);
    if (historico) {
      const legacy = toRentaLegacy(historico);
      const mesAnterior = await this.findRegistroMesAnterior(legacy);
      return {
        origen: "historico" as const,
        data: mapHistoricoPagoRentaResponse(legacy, mesAnterior),
      };
    }

    const rentaActual = await buscar(0);
    if (rentaActual) {
      return {
        origen: "rentaActual" as const,
        data: mapPagoRentaDesglose(toRentaLegacy(rentaActual)),
      };
    }

    throw new NotFoundException(
      `No se encontró pago de renta para arrendatario ${idArrendatario} y contrato ${idContrato}.`,
    );
  }

  async findAllPaginated(
    page: number,
    limit: number,
    filters: HistoricoPagosRentaFilters,
    idCliente: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const skip = (safePage - 1) * safeLimit;
    const { mesKeyInicio, mesKeyFin } = parseRangoMeses(
      filters.fechaInicio,
      filters.fechaFin,
    );

    // Rol > 1: solo pagos de arrendatarios de arrendadores del cliente JWT
    let arrendadorIds: number[] | null = null;
    if (!isSuperAdmin(rol)) {
      const scope = await getClienteHijos(
        this.arrendadoresRepository,
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

    const qb = this.cargosRepository
      .createQueryBuilder("h")
      .leftJoinAndSelect("h.arrendatario", "arrendatario")
      .leftJoinAndSelect("h.contrato", "contrato")
      .leftJoinAndSelect("contrato.inmueble", "inmueble")
      .leftJoinAndSelect("contrato.contratoLocales", "contratoLocales")
      .leftJoinAndSelect("contratoLocales.local", "local")
      .leftJoinAndSelect("h.formula", "formula")
      .leftJoinAndSelect("h.conceptos", "conceptos")
      // Histórico = cargos de renta liquidados.
      .where("h.clase = 'RENTA' AND h.estatus = 1 AND h.liquidado = 1")
      .andWhere(sqlMesEnRango("h.mes"), { mesKeyInicio, mesKeyFin });

    if (arrendadorIds) {
      qb.andWhere("arrendatario.idArrendador IN (:...arrendadorIds)", {
        arrendadorIds,
      });
    }

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

    const data = (
      await qb
        .orderBy("h.mes", "DESC")
        .addOrderBy("h.id", "DESC")
        .skip(skip)
        .take(safeLimit)
        .getMany()
    ).map(toRentaLegacy);

    const anterioresPorId = await this.loadRegistrosMesAnterior(data);

    return {
      data: data.map((row) =>
        mapHistoricoPagoRentaResponse(row, anterioresPorId.get(row.id) ?? null),
      ),
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

  assertRequiredInt(value: string | undefined, field: string): number {
    if (value === undefined || value === "") {
      throw new BadRequestException(`${field} es requerido.`);
    }
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

  /** Cargo liquidado inmediatamente anterior (por mes) del mismo arrendatario + contrato. */
  private async findRegistroMesAnterior(row: RentaLegacy): Promise<RentaLegacy | null> {
    if (row.idArrendatario == null || row.idContrato == null || row.mes == null) {
      return null;
    }
    const anterior = await this.cargosRepository
      .createQueryBuilder("h")
      .leftJoinAndSelect("h.conceptos", "conceptos")
      .where("h.idArrendatario = :idArrendatario", { idArrendatario: row.idArrendatario })
      .andWhere("h.idContrato = :idContrato", { idContrato: row.idContrato })
      .andWhere("h.clase = 'RENTA' AND h.estatus = 1 AND h.liquidado = 1")
      .andWhere("h.mes < :mes", { mes: row.mes })
      .orderBy("h.mes", "DESC")
      .addOrderBy("h.id", "DESC")
      .getOne();
    return anterior ? toRentaLegacy(anterior) : null;
  }

  private async loadRegistrosMesAnterior(
    rows: RentaLegacy[],
  ): Promise<Map<number, RentaLegacy | null>> {
    const result = new Map<number, RentaLegacy | null>();
    if (rows.length === 0) {
      return result;
    }

    const pairs = new Map<string, { idArrendatario: number; idContrato: number }>();
    for (const row of rows) {
      if (row.idArrendatario == null || row.idContrato == null) {
        result.set(row.id, null);
        continue;
      }
      pairs.set(`${row.idArrendatario}|${row.idContrato}`, {
        idArrendatario: Number(row.idArrendatario),
        idContrato: Number(row.idContrato),
      });
    }

    if (pairs.size === 0) {
      for (const row of rows) {
        if (!result.has(row.id)) result.set(row.id, null);
      }
      return result;
    }

    const qb = this.cargosRepository
      .createQueryBuilder("h")
      .leftJoinAndSelect("h.conceptos", "conceptos")
      .where("h.clase = 'RENTA' AND h.estatus = 1 AND h.liquidado = 1");
    qb.andWhere(
      new Brackets((sub) => {
        let i = 0;
        for (const pair of pairs.values()) {
          const clause = `(h.idArrendatario = :a${i} AND h.idContrato = :c${i})`;
          const params = {
            [`a${i}`]: pair.idArrendatario,
            [`c${i}`]: pair.idContrato,
          };
          if (i === 0) sub.where(clause, params);
          else sub.orWhere(clause, params);
          i++;
        }
      }),
    );

    const historicoPorPar = (
      await qb.orderBy("h.mes", "ASC").addOrderBy("h.id", "ASC").getMany()
    ).map(toRentaLegacy);

    const byPair = new Map<string, RentaLegacy[]>();
    for (const registro of historicoPorPar) {
      const key = `${registro.idArrendatario}|${registro.idContrato}`;
      const list = byPair.get(key) ?? [];
      list.push(registro);
      byPair.set(key, list);
    }

    for (const row of rows) {
      if (result.has(row.id)) continue;
      const key = `${row.idArrendatario}|${row.idContrato}`;
      const list = byPair.get(key) ?? [];
      const idx = list.findIndex((r) => r.id === row.id);
      result.set(row.id, idx > 0 ? list[idx - 1]! : null);
    }

    return result;
  }
}
