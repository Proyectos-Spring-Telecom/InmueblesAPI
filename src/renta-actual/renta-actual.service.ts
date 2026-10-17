import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, Repository } from "typeorm";
import { ApiResponseCommon } from "src/common/ApiResponse";
import { findContratoActivo } from "src/common/contrato-validation";
import {
  addOneMonth,
  getMesActual,
  mapPagoRentaDesglose,
} from "src/common/pago-mensual.utils";
import { CARGO_RENTA_RELATIONS, toRentaLegacy } from "src/cobranza/cobranza-legacy";
import { CobranzaService, ConceptoInput } from "src/cobranza/cobranza.service";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { Cargos } from "src/entities/Cargos";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Formulas } from "src/entities/Formulas";
import { getClienteHijos, isSuperAdmin } from "src/utils/cliente-utils";
import { CreateRentaActualDto } from "./dto/create-renta-actual.dto";
import { UpdateRentaActualDto } from "./dto/update-renta-actual.dto";

/** Montos de renta/mantenimiento del DTO → conceptos del cargo. */
export function conceptosDeRenta(dto: {
  total?: number | null;
  montoFinal?: number | null;
  totalMantenimiento?: number | null;
  montoFinalMantenimiento?: number | null;
}): ConceptoInput[] {
  const conceptos: ConceptoInput[] = [
    { tipo: "RENTA", montoBase: dto.total ?? null, montoFinal: dto.montoFinal ?? null },
  ];
  if (dto.totalMantenimiento != null || dto.montoFinalMantenimiento != null) {
    conceptos.push({
      tipo: "MANTENIMIENTO",
      montoBase: dto.totalMantenimiento ?? null,
      montoFinal: dto.montoFinalMantenimiento ?? null,
    });
  }
  return conceptos;
}

function parseFechaFin(value: string | null | undefined): Date | null {
  return value != null && String(value).trim() !== "" ? new Date(value) : null;
}

/**
 * "Renta actual" = cargos de renta con saldo pendiente, más los del mes en curso.
 * Sobre el modelo de cargos (`Cargos`/`CargoConceptos`); mantiene la forma de respuesta anterior.
 */
@Injectable()
export class RentaActualService {
  private readonly logger = new Logger(RentaActualService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Cargos)
    private readonly cargosRepository: Repository<Cargos>,
    @InjectRepository(Arrendatarios)
    private readonly arrendatariosRepository: Repository<Arrendatarios>,
    @InjectRepository(ContratoArrendatarios)
    private readonly contratoRepository: Repository<ContratoArrendatarios>,
    @InjectRepository(Formulas)
    private readonly formulasRepository: Repository<Formulas>,
    private readonly cobranza: CobranzaService,
  ) {}

  async create(dto: CreateRentaActualDto) {
    await this.assertArrendatario(dto.idArrendatario);
    await this.assertContrato(dto.idContrato, dto.idArrendatario);
    await this.assertFormula(dto.idFormula);

    const mes = new Date(dto.fechaInicio);
    const fechaFin = parseFechaFin(dto.fechaFin);
    this.assertRangoFechasValido(mes, fechaFin);

    const id = await this.dataSource.transaction(async (m) => {
      await this.cobranza.assertSinSolapamiento(m, dto.idArrendatario, dto.idContrato, mes, fechaFin);
      return this.cobranza.crearCargo(m, {
        idArrendatario: dto.idArrendatario,
        idContrato: dto.idContrato,
        clase: "RENTA",
        mes,
        fechaFin,
        idFormula: dto.idFormula ?? null,
        usaFormula: dto.usaFormula ?? null,
        ocupoFormula: dto.ocupoFormula ?? null,
        factorVariable: dto.factorVariable ?? null,
        origen: "RENTA_MENSUAL",
        conceptos: conceptosDeRenta(dto),
      });
    });

    return {
      status: "success",
      message: "Renta actual registrada correctamente.",
      data: await this.findOne(id),
    };
  }

  async duplicarSiguienteMes(id: number) {
    const source = await this.cargosRepository.findOne({
      where: { id, clase: "RENTA", estatus: 1 },
      relations: ["conceptos"],
    });
    if (!source) {
      throw new NotFoundException(`Renta actual con id ${id} no encontrada.`);
    }
    if (source.fechaFin) {
      throw new BadRequestException(
        `La renta actual con id ${id} es de periodo (EsPeriodo=1) y no se puede duplicar al mes siguiente.`,
      );
    }
    if (source.idContrato == null) {
      throw new BadRequestException(
        `La renta actual con id ${id} no tiene arrendatario o contrato.`,
      );
    }

    await this.assertContrato(Number(source.idContrato), Number(source.idArrendatario));
    const mesSiguiente = addOneMonth(new Date(source.mes));
    const legacy = toRentaLegacy(source);

    const nuevoId = await this.dataSource.transaction(async (m) => {
      await this.cobranza.assertSinSolapamiento(
        m,
        Number(source.idArrendatario),
        Number(source.idContrato),
        mesSiguiente,
        null,
      );
      // El mes siguiente siempre nace pendiente (antes copiaba el estado "pagada" del origen).
      return this.cobranza.crearCargo(m, {
        idArrendatario: Number(source.idArrendatario),
        idContrato: Number(source.idContrato),
        clase: "RENTA",
        mes: mesSiguiente,
        fechaFin: null,
        idFormula: source.idFormula,
        usaFormula: source.usaFormula,
        ocupoFormula: source.ocupoFormula,
        factorVariable: source.factorVariable,
        origen: "RENTA_MENSUAL",
        conceptos: conceptosDeRenta({
          total: legacy.total != null ? Number(legacy.total) : null,
          montoFinal: legacy.montoFinal != null ? Number(legacy.montoFinal) : null,
          totalMantenimiento: legacy.totalMantenimiento != null ? Number(legacy.totalMantenimiento) : null,
          montoFinalMantenimiento:
            legacy.montoFinalMantenimiento != null ? Number(legacy.montoFinalMantenimiento) : null,
        }),
      });
    });

    return {
      status: "success",
      message: "Renta actual duplicada al mes siguiente correctamente.",
      data: await this.findOne(nuevoId),
    };
  }

  async update(id: number, dto: UpdateRentaActualDto) {
    const current = await this.cargosRepository.findOne({ where: { id, clase: "RENTA", estatus: 1 } });
    if (!current) {
      throw new NotFoundException(`Renta actual con id ${id} no encontrada.`);
    }
    if (current.idContrato != null) {
      await findContratoActivo(this.contratoRepository, Number(current.idContrato), Number(current.idArrendatario));
    }
    if (dto.idFormula !== undefined) {
      await this.assertFormula(dto.idFormula);
    }

    await this.dataSource.transaction(async (m) => {
      if (dto.fechaFin !== undefined) {
        const fechaFin = parseFechaFin(dto.fechaFin);
        this.assertRangoFechasValido(new Date(current.mes), fechaFin);
        await this.cobranza.assertSinSolapamiento(
          m,
          Number(current.idArrendatario),
          Number(current.idContrato),
          new Date(current.mes),
          fechaFin,
          id,
        );
      }
      await this.aplicarCambiosCargo(m, id, dto);
    });

    return {
      status: "success",
      message: "Renta actual actualizada correctamente.",
      data: await this.findOne(id),
    };
  }

  /** Cambios de cabecera y montos comunes a renta actual e histórico. */
  async aplicarCambiosCargo(m: EntityManager, id: number, dto: UpdateRentaActualDto): Promise<void> {
    await m.update(Cargos, id, {
      ...(dto.idFormula !== undefined && { idFormula: dto.idFormula ?? null }),
      ...(dto.fechaFin !== undefined && { fechaFin: parseFechaFin(dto.fechaFin) }),
      ...(dto.usaFormula !== undefined && { usaFormula: dto.usaFormula ?? null }),
      ...(dto.factorVariable !== undefined && {
        factorVariable: dto.factorVariable != null ? String(dto.factorVariable) : null,
      }),
      ...(dto.ocupoFormula !== undefined && { ocupoFormula: dto.ocupoFormula ?? null }),
      fhActualizacion: new Date(),
    });
    if (dto.total !== undefined || dto.montoFinal !== undefined) {
      await this.cobranza.upsertConcepto(m, id, {
        tipo: "RENTA",
        ...(dto.total !== undefined && { montoBase: dto.total ?? null }),
        ...(dto.montoFinal !== undefined && { montoFinal: dto.montoFinal ?? null }),
      });
    }
    if (dto.totalMantenimiento !== undefined || dto.montoFinalMantenimiento !== undefined) {
      await this.cobranza.upsertConcepto(m, id, {
        tipo: "MANTENIMIENTO",
        ...(dto.totalMantenimiento !== undefined && { montoBase: dto.totalMantenimiento ?? null }),
        ...(dto.montoFinalMantenimiento !== undefined && {
          montoFinal: dto.montoFinalMantenimiento ?? null,
        }),
      });
    }
    await this.cobranza.recalcularCargo(m, id);
  }

  /**
   * Liquida el saldo pendiente con un pago por ese monto. Se permite aunque el contrato
   * esté cancelado: un contrato dado de baja puede seguir pagando lo que debe.
   */
  async marcarPagada(id: number, idUsuario: number | null = null) {
    const cargo = await this.cargosRepository.findOne({ where: { id, clase: "RENTA", estatus: 1 } });
    if (!cargo) {
      throw new NotFoundException(`Renta actual con id ${id} no encontrada.`);
    }
    if (Number(cargo.liquidado) === 1) {
      throw new BadRequestException("La renta ya está marcada como pagada.");
    }
    await this.dataSource.transaction((m) =>
      this.cobranza.liquidarCargo(m, id, { idUsuario, origen: "CAPTURA" }),
    );
    return {
      status: "success",
      message: "Renta marcada como pagada.",
      data: await this.findOne(id),
    };
  }

  /**
   * Antes movía las rentas pagadas de meses anteriores al histórico. Con el modelo de
   * cargos el registro no cambia de tabla: el "histórico" son los cargos liquidados.
   */
  async archivarRentasPagadasMesesAnteriores(): Promise<{ archivadas: number }> {
    return { archivadas: 0 };
  }

  async findOne(id: number) {
    const data = await this.cargosRepository.findOne({
      where: { id, clase: "RENTA" },
      relations: [...CARGO_RENTA_RELATIONS],
    });
    if (!data) {
      throw new NotFoundException(`Renta actual con id ${id} no encontrada.`);
    }
    return mapPagoRentaDesglose(toRentaLegacy(data));
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
      const scope = await getClienteHijos(this.arrendatariosRepository, idCliente);
      if (scope.ids.length === 0) {
        return { data: [], paginated: { total: 0, page: safePage, lastPage: 0 } };
      }
      arrendadorIds = scope.ids;
    }

    const mesActual = getMesActual();
    const qb = this.cargosRepository
      .createQueryBuilder("c")
      .leftJoin("c.arrendatario", "arrendatario")
      .where("c.clase = 'RENTA' AND c.estatus = 1")
      // Pendientes (incluye parciales) y los del mes en curso aunque ya estén pagados.
      .andWhere("(c.liquidado = 0 OR (YEAR(c.mes) = :anio AND MONTH(c.mes) = :mes))", {
        anio: mesActual.getFullYear(),
        mes: mesActual.getMonth() + 1,
      });
    if (arrendadorIds) {
      qb.andWhere("arrendatario.idArrendador IN (:...arrendadorIds)", { arrendadorIds });
    }

    const total = await qb.getCount();
    const idRows = await qb
      .select("c.id", "id")
      .orderBy("c.id", "DESC")
      .skip(skip)
      .take(safeLimit)
      .getRawMany<{ id: string }>();

    if (idRows.length === 0) {
      return {
        data: [],
        paginated: { total, page: safePage, lastPage: total === 0 ? 0 : Math.ceil(total / safeLimit) },
      };
    }

    const data = await this.cargosRepository.find({
      where: { id: In(idRows.map((r) => Number(r.id))) },
      relations: [...CARGO_RENTA_RELATIONS],
      order: { id: "DESC" },
    });

    return {
      data: data.map((c) => mapPagoRentaDesglose(toRentaLegacy(c))),
      paginated: { total, page: safePage, lastPage: Math.ceil(total / safeLimit) },
    };
  }

  private assertRangoFechasValido(fechaInicio: Date, fechaFin: Date | null) {
    if (Number.isNaN(fechaInicio.getTime())) {
      throw new BadRequestException("fechaInicio no es una fecha válida.");
    }
    if (fechaFin != null && Number.isNaN(fechaFin.getTime())) {
      throw new BadRequestException("fechaFin no es una fecha válida.");
    }
    if (fechaFin != null && fechaFin < fechaInicio) {
      throw new BadRequestException("fechaFin no puede ser anterior a fechaInicio.");
    }
  }

  private async assertArrendatario(idArrendatario: number) {
    const row = await this.arrendatariosRepository.findOne({ where: { id: idArrendatario }, select: ["id"] });
    if (!row) {
      throw new NotFoundException(`Arrendatario con id ${idArrendatario} no encontrado.`);
    }
  }

  private async assertContrato(idContrato: number, idArrendatario: number) {
    await findContratoActivo(this.contratoRepository, idContrato, idArrendatario);
  }

  private async assertFormula(idFormula: number | undefined | null) {
    if (idFormula == null) return;
    const formula = await this.formulasRepository.findOne({ where: { id: idFormula }, select: ["id"] });
    if (!formula) {
      throw new NotFoundException(`Fórmula con id ${idFormula} no encontrada.`);
    }
  }
}
