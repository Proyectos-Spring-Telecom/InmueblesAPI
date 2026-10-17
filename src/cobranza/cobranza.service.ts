import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EntityManager } from "typeorm";
import { CargoConceptos, TipoConceptoCargo } from "src/entities/CargoConceptos";
import { Cargos, ClaseCargo } from "src/entities/Cargos";
import { PagoAplicaciones } from "src/entities/PagoAplicaciones";
import { PagoRecibidoEstatus, Pagos } from "src/entities/Pagos";
import { cents, desglosarIva, desgloseDeContrato, money, moneyOrNull, MontosContrato, TASA_IVA, totalConcepto } from "./money";

export interface ConceptoInput {
  tipo: TipoConceptoCargo;
  montoBase?: number | string | null;
  montoFinal?: number | string | null;
  /** Si se capturan, se respetan; si no, se calculan del total al 16 %. */
  subtotal?: number | string | null;
  iva?: number | string | null;
  idTipoServicio?: number | null;
  idServicioArrendatario?: number | null;
  descripcion?: string | null;
  desgloseEstimado?: boolean;
}

export interface CargoInput {
  idArrendatario: number;
  idContrato: number | null;
  clase: ClaseCargo;
  mes: Date;
  fechaFin?: Date | null;
  descripcion?: string | null;
  idFormula?: number | null;
  usaFormula?: number | null;
  ocupoFormula?: number | null;
  factorVariable?: number | string | null;
  origen: string;
  idUsuario?: number | null;
  conceptos: ConceptoInput[];
  idLegacyRentaActual?: number | null;
  idLegacyHistorico?: number | null;
  idLegacyPagoArrendatario?: number | null;
}

export interface PagoInput {
  idArrendatario: number;
  fechaPago: Date;
  fechaPagoFinal?: Date | null;
  monto: number | string;
  idMetodoPago?: number | null;
  formaPagoSat?: string | null;
  referencia?: string | null;
  concepto?: string | null;
  comprobanteUrl?: string | null;
  idCargoReferencia?: number | null;
  origen: string;
  estatus?: PagoRecibidoEstatus;
  idUsuario?: number | null;
  idLegacyPagoArrendatario?: number | null;
}

export interface AplicacionInput {
  idCargoConcepto: number;
  monto: number | string;
}

/**
 * Reglas de cargos, pagos y aplicaciones. Todos los métodos reciben el EntityManager de una
 * transacción abierta por quien llama, para que el cambio y el recálculo de saldos sean atómicos.
 */
@Injectable()
export class CobranzaService {
  // ─── Cargos ─────────────────────────────────────────────────────────────────

  async crearCargo(m: EntityManager, input: CargoInput): Promise<number> {
    if (input.conceptos.length === 0) {
      throw new BadRequestException("Un cargo requiere al menos un concepto.");
    }
    const cargo = await m.save(
      m.create(Cargos, {
        idArrendatario: input.idArrendatario,
        idContrato: input.idContrato,
        clase: input.clase,
        mes: input.mes,
        fechaFin: input.fechaFin ?? null,
        descripcion: input.descripcion ?? null,
        idFormula: input.idFormula ?? null,
        usaFormula: input.usaFormula ?? null,
        ocupoFormula: input.ocupoFormula ?? null,
        factorVariable: moneyOrNull(input.factorVariable),
        origen: input.origen,
        estatus: 1,
        idUsuarioRegistro: input.idUsuario ?? null,
        idLegacyRentaActual: input.idLegacyRentaActual ?? null,
        idLegacyHistorico: input.idLegacyHistorico ?? null,
        idLegacyPagoArrendatario: input.idLegacyPagoArrendatario ?? null,
      }),
    );
    for (const concepto of await this.conDesgloseDeContrato(m, input.idContrato, input.conceptos)) {
      await m.save(m.create(CargoConceptos, this.buildConcepto(Number(cargo.id), concepto)));
    }
    await this.recalcularCargo(m, Number(cargo.id));
    return Number(cargo.id);
  }

  /**
   * Crea o actualiza el concepto de un tipo dentro de un cargo. Rechaza dejar un total
   * menor a lo ya pagado de ese concepto.
   */
  async upsertConcepto(m: EntityManager, idCargo: number, input: ConceptoInput): Promise<void> {
    const existente = await m.findOne(CargoConceptos, {
      where: { idCargo, tipo: input.tipo, estatus: 1 },
    });
    const [cargo] = await m.query(`SELECT IdContrato AS idContrato FROM Cargos WHERE Id = ?`, [idCargo]);
    const idContrato = cargo?.idContrato != null ? Number(cargo.idContrato) : null;
    if (!existente) {
      const [conDesglose] = await this.conDesgloseDeContrato(m, idContrato, [input]);
      await m.save(m.create(CargoConceptos, this.buildConcepto(idCargo, conDesglose)));
      return;
    }
    const [nuevoInput] = await this.conDesgloseDeContrato(m, idContrato, [{
      tipo: input.tipo,
      montoBase: input.montoBase !== undefined ? input.montoBase : existente.montoBase,
      montoFinal: input.montoFinal !== undefined ? input.montoFinal : existente.montoFinal,
      subtotal: input.subtotal,
      iva: input.iva,
      idTipoServicio: input.idTipoServicio ?? existente.idTipoServicio,
      idServicioArrendatario: input.idServicioArrendatario ?? existente.idServicioArrendatario,
      descripcion: input.descripcion ?? existente.descripcion,
    }]);
    const nuevo = this.buildConcepto(idCargo, nuevoInput);
    if (cents(nuevo.total) < cents(existente.pagado)) {
      throw new ConflictException(
        `El nuevo monto de ${input.tipo.toLowerCase()} (${nuevo.total}) es menor a lo ya pagado (${existente.pagado}).`,
      );
    }
    await m.update(CargoConceptos, existente.id, {
      montoBase: nuevo.montoBase,
      montoFinal: nuevo.montoFinal,
      total: nuevo.total,
      subtotal: nuevo.subtotal,
      iva: nuevo.iva,
      desgloseEstimado: nuevo.desgloseEstimado,
      descripcion: nuevo.descripcion,
    });
  }

  /**
   * Para renta y mantenimiento sin desglose capturado: si el total es el del contrato, usa el
   * subtotal y el IVA del contrato (desglose no estimado). Si no, se deja para estimar al 16 %.
   */
  private async conDesgloseDeContrato(
    m: EntityManager,
    idContrato: number | null,
    conceptos: ConceptoInput[],
  ): Promise<ConceptoInput[]> {
    const sinDesglose = (c: ConceptoInput) =>
      (c.tipo === "RENTA" || c.tipo === "MANTENIMIENTO") &&
      (c.subtotal === undefined || c.subtotal === null || c.iva === undefined || c.iva === null);
    if (!idContrato || !conceptos.some(sinDesglose)) return conceptos;
    const [ct] = await m.query(
      `SELECT RentaTotal, SubTotalRenta, IVARenta, MantenimientoTotal, SubTotalMantenimiento, IVAMantenimiento
         FROM ContratoArrendatarios WHERE Id = ?`,
      [idContrato],
    );
    if (!ct) return conceptos;
    return conceptos.map((c) => {
      if (!sinDesglose(c)) return c;
      const ref: MontosContrato =
        c.tipo === "RENTA"
          ? { total: ct.RentaTotal, subtotal: ct.SubTotalRenta, iva: ct.IVARenta }
          : { total: ct.MantenimientoTotal, subtotal: ct.SubTotalMantenimiento, iva: ct.IVAMantenimiento };
      const desglose = desgloseDeContrato(totalConcepto(c.montoBase ?? null, c.montoFinal ?? null), ref);
      return desglose ? { ...c, subtotal: money(desglose.subtotal), iva: money(desglose.iva) } : c;
    });
  }

  private buildConcepto(idCargo: number, c: ConceptoInput): Partial<CargoConceptos> {
    const total = totalConcepto(c.montoBase ?? null, c.montoFinal ?? null);
    const capturado =
      c.subtotal !== undefined && c.subtotal !== null && c.iva !== undefined && c.iva !== null;
    if (capturado && cents(c.subtotal) + cents(c.iva) !== total) {
      throw new BadRequestException(
        `Subtotal (${c.subtotal}) + IVA (${c.iva}) no coincide con el total ${money(total)}.`,
      );
    }
    const desglose = capturado
      ? { subtotal: cents(c.subtotal), iva: cents(c.iva) }
      : desglosarIva(total);
    return {
      idCargo,
      tipo: c.tipo,
      idTipoServicio: c.idTipoServicio ?? null,
      idServicioArrendatario: c.idServicioArrendatario ?? null,
      descripcion: c.descripcion ?? null,
      montoBase: moneyOrNull(c.montoBase),
      montoFinal: moneyOrNull(c.montoFinal),
      total: money(total),
      tasaIva: TASA_IVA.toFixed(4),
      subtotal: money(desglose.subtotal),
      iva: money(desglose.iva),
      desgloseEstimado: capturado ? 0 : 1,
      pagado: "0.00",
      saldo: money(total),
      estatus: 1,
    };
  }

  /** Recalcula pagado/saldo de los conceptos y del cargo a partir de las aplicaciones vigentes. */
  async recalcularCargo(m: EntityManager, idCargo: number): Promise<void> {
    const conceptos: { id: string; total: string; pagado: string }[] = await m.query(
      `SELECT cc.Id AS id, cc.Total AS total, COALESCE(SUM(pa.Monto), 0) AS pagado
         FROM CargoConceptos cc
         LEFT JOIN PagoAplicaciones pa ON pa.IdCargoConcepto = cc.Id AND pa.Estatus = 1
        WHERE cc.IdCargo = ? AND cc.Estatus = 1
        GROUP BY cc.Id, cc.Total`,
      [idCargo],
    );
    let total = 0;
    let pagado = 0;
    for (const c of conceptos) {
      const t = cents(c.total);
      const p = cents(c.pagado);
      total += t;
      pagado += p;
      await m.update(CargoConceptos, Number(c.id), { pagado: money(p), saldo: money(t - p) });
    }
    const cargo = await m.findOne(Cargos, { where: { id: idCargo }, select: ["id", "marcaPagadoSinMonto"] });
    const saldo = total - pagado;
    const liquidado = saldo <= 0 && (total > 0 || Number(cargo?.marcaPagadoSinMonto) === 1) ? 1 : 0;
    await m.update(Cargos, idCargo, {
      total: money(total),
      pagado: money(pagado),
      saldo: money(saldo),
      liquidado,
      fhActualizacion: new Date(),
    });
  }

  /**
   * Regla de renta y mantenimiento: un cargo por contrato y mes, sin solapar periodos
   * (misma regla del modelo anterior, comparando año-mes).
   */
  async assertSinSolapamiento(
    m: EntityManager,
    idArrendatario: number,
    idContrato: number,
    inicio: Date,
    fin: Date | null,
    excludeId?: number,
  ): Promise<void> {
    const key = (d: Date) => d.getFullYear() * 12 + d.getMonth();
    const nuevoIni = key(inicio);
    const nuevoFin = key(fin ?? inicio);
    const existentes = await m.find(Cargos, {
      where: { idArrendatario, idContrato, clase: "RENTA", estatus: 1 },
      select: ["id", "mes", "fechaFin"],
    });
    for (const c of existentes) {
      if (excludeId != null && Number(c.id) === Number(excludeId)) continue;
      const ini = key(new Date(c.mes));
      const finE = key(new Date(c.fechaFin ?? c.mes));
      if (nuevoIni <= finE && ini <= nuevoFin) {
        const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        throw new ConflictException(
          `Ya existe un cargo que cubre el mes ${fmt(inicio)} (o se solapa con el periodo) ` +
            `para arrendatario ${idArrendatario}, contrato ${idContrato}. Conflicto con cargo id=${c.id}.`,
        );
      }
    }
  }

  // ─── Pagos y aplicaciones ──────────────────────────────────────────────────

  async registrarPago(m: EntityManager, input: PagoInput, aplicaciones: AplicacionInput[] = []): Promise<number> {
    const monto = cents(input.monto);
    if (monto <= 0) throw new BadRequestException("El monto del pago debe ser mayor a 0.");
    const estatus = input.estatus ?? PagoRecibidoEstatus.Confirmado;
    if (estatus !== PagoRecibidoEstatus.Confirmado && aplicaciones.length > 0) {
      throw new BadRequestException("Sólo un pago confirmado puede aplicarse a cargos.");
    }
    const pago = await m.save(
      m.create(Pagos, {
        idArrendatario: input.idArrendatario,
        fechaPago: input.fechaPago,
        fechaPagoFinal: input.fechaPagoFinal ?? null,
        monto: money(monto),
        aplicado: "0.00",
        disponible: estatus === PagoRecibidoEstatus.Confirmado ? money(monto) : "0.00",
        idMetodoPago: input.idMetodoPago ?? null,
        formaPagoSat: input.formaPagoSat ?? null,
        referencia: input.referencia ?? null,
        concepto: input.concepto ?? null,
        comprobanteUrl: input.comprobanteUrl ?? null,
        idCargoReferencia: input.idCargoReferencia ?? null,
        origen: input.origen,
        estatus,
        idUsuarioRegistro: input.idUsuario ?? null,
        idLegacyPagoArrendatario: input.idLegacyPagoArrendatario ?? null,
      }),
    );
    if (aplicaciones.length > 0) {
      await this.aplicar(m, Number(pago.id), aplicaciones, input.idUsuario ?? null);
    }
    return Number(pago.id);
  }

  async aplicar(
    m: EntityManager,
    idPago: number,
    aplicaciones: AplicacionInput[],
    idUsuario: number | null,
  ): Promise<void> {
    // Bloqueo del pago: evita aplicar dos veces el mismo disponible en paralelo.
    const [pago] = await m.query(
      `SELECT Id, IdArrendatario, Monto, Estatus FROM Pagos WHERE Id = ? FOR UPDATE`,
      [idPago],
    );
    if (!pago) throw new NotFoundException(`Pago ${idPago} no encontrado.`);
    if (Number(pago.Estatus) !== PagoRecibidoEstatus.Confirmado) {
      throw new BadRequestException("Sólo un pago confirmado puede aplicarse a cargos.");
    }
    const [{ aplicado }] = await m.query(
      `SELECT COALESCE(SUM(Monto), 0) AS aplicado FROM PagoAplicaciones WHERE IdPago = ? AND Estatus = 1`,
      [idPago],
    );
    let disponible = cents(pago.Monto) - cents(aplicado);

    const cargosAfectados = new Set<number>();
    for (const ap of aplicaciones) {
      const monto = cents(ap.monto);
      if (monto <= 0) throw new BadRequestException("Cada aplicación debe ser mayor a 0.");
      const [concepto] = await m.query(
        `SELECT cc.Id, cc.IdCargo, cc.Total, cc.Estatus, c.IdArrendatario, c.Estatus AS EstatusCargo
           FROM CargoConceptos cc JOIN Cargos c ON c.Id = cc.IdCargo
          WHERE cc.Id = ? FOR UPDATE`,
        [ap.idCargoConcepto],
      );
      if (!concepto || Number(concepto.Estatus) !== 1 || Number(concepto.EstatusCargo) !== 1) {
        throw new NotFoundException(`Concepto de cargo ${ap.idCargoConcepto} no encontrado o cancelado.`);
      }
      if (Number(concepto.IdArrendatario) !== Number(pago.IdArrendatario)) {
        throw new BadRequestException(
          `El concepto ${ap.idCargoConcepto} no pertenece al arrendatario del pago.`,
        );
      }
      const [{ pagado }] = await m.query(
        `SELECT COALESCE(SUM(Monto), 0) AS pagado FROM PagoAplicaciones WHERE IdCargoConcepto = ? AND Estatus = 1`,
        [ap.idCargoConcepto],
      );
      const saldo = cents(concepto.Total) - cents(pagado);
      if (monto > saldo) {
        throw new BadRequestException(
          `El monto ${money(monto)} excede el saldo del concepto ${ap.idCargoConcepto} (${money(saldo)}).`,
        );
      }
      if (monto > disponible) {
        throw new BadRequestException(
          `El monto ${money(monto)} excede el disponible del pago ${idPago} (${money(disponible)}).`,
        );
      }
      await m.save(
        m.create(PagoAplicaciones, {
          idPago,
          idCargoConcepto: ap.idCargoConcepto,
          monto: money(monto),
          estatus: 1,
          idUsuarioRegistro: idUsuario,
        }),
      );
      disponible -= monto;
      cargosAfectados.add(Number(concepto.IdCargo));
    }
    for (const idCargo of cargosAfectados) await this.recalcularCargo(m, idCargo);
    await this.recalcularPago(m, idPago);
  }

  async anularAplicacion(m: EntityManager, idAplicacion: number, idUsuario: number | null): Promise<void> {
    const ap = await m.findOne(PagoAplicaciones, { where: { id: idAplicacion }, relations: ["cargoConcepto"] });
    if (!ap || Number(ap.estatus) !== 1) throw new NotFoundException(`Aplicación ${idAplicacion} no encontrada.`);
    await m.update(PagoAplicaciones, ap.id, { estatus: 0, fhAnulacion: new Date(), idUsuarioAnulacion: idUsuario });
    await this.recalcularCargo(m, Number(ap.cargoConcepto.idCargo));
    await this.recalcularPago(m, Number(ap.idPago));
  }

  /** Cancela un pago (R6): anula sus aplicaciones y recalcula saldos. */
  async cancelarPago(m: EntityManager, idPago: number, motivo: string | null, idUsuario: number | null): Promise<void> {
    const pago = await m.findOne(Pagos, { where: { id: idPago } });
    if (!pago) throw new NotFoundException(`Pago ${idPago} no encontrado.`);
    if (Number(pago.estatus) === PagoRecibidoEstatus.Cancelado) return;
    const cargos = await this.anularAplicacionesDePago(m, idPago, idUsuario);
    await m.update(Pagos, idPago, {
      estatus: PagoRecibidoEstatus.Cancelado,
      motivoCancelacion: motivo,
      fhCancelacion: new Date(),
      idUsuarioCancelacion: idUsuario,
    });
    for (const idCargo of cargos) await this.recalcularCargo(m, idCargo);
    await this.recalcularPago(m, idPago);
  }

  /** Cambia el estatus de un pago entre confirmado y por confirmar (compatibilidad). */
  async cambiarEstatusPago(
    m: EntityManager,
    idPago: number,
    estatus: PagoRecibidoEstatus,
    idUsuario: number | null,
  ): Promise<void> {
    if (estatus === PagoRecibidoEstatus.Cancelado) {
      await this.cancelarPago(m, idPago, null, idUsuario);
      return;
    }
    let cargos: number[] = [];
    if (estatus === PagoRecibidoEstatus.PorConfirmar) {
      cargos = await this.anularAplicacionesDePago(m, idPago, idUsuario);
    }
    await m.update(Pagos, idPago, { estatus });
    for (const idCargo of cargos) await this.recalcularCargo(m, idCargo);
    await this.recalcularPago(m, idPago);
  }

  private async anularAplicacionesDePago(m: EntityManager, idPago: number, idUsuario: number | null): Promise<number[]> {
    const vigentes: { idCargo: string }[] = await m.query(
      `SELECT DISTINCT cc.IdCargo AS idCargo
         FROM PagoAplicaciones pa JOIN CargoConceptos cc ON cc.Id = pa.IdCargoConcepto
        WHERE pa.IdPago = ? AND pa.Estatus = 1`,
      [idPago],
    );
    await m.update(
      PagoAplicaciones,
      { idPago, estatus: 1 },
      { estatus: 0, fhAnulacion: new Date(), idUsuarioAnulacion: idUsuario },
    );
    return vigentes.map((v) => Number(v.idCargo));
  }

  /** Anula todas las aplicaciones vigentes a un cargo; el dinero queda como saldo a favor. */
  async anularAplicacionesDeCargo(m: EntityManager, idCargo: number, idUsuario: number | null): Promise<void> {
    const pagos: { idPago: string }[] = await m.query(
      `SELECT DISTINCT pa.IdPago AS idPago
         FROM PagoAplicaciones pa JOIN CargoConceptos cc ON cc.Id = pa.IdCargoConcepto
        WHERE cc.IdCargo = ? AND pa.Estatus = 1`,
      [idCargo],
    );
    await m.query(
      `UPDATE PagoAplicaciones pa JOIN CargoConceptos cc ON cc.Id = pa.IdCargoConcepto
          SET pa.Estatus = 0, pa.FHAnulacion = NOW(), pa.IdUsuarioAnulacion = ?
        WHERE cc.IdCargo = ? AND pa.Estatus = 1`,
      [idUsuario, idCargo],
    );
    await m.update(Cargos, idCargo, { marcaPagadoSinMonto: 0 });
    await this.recalcularCargo(m, idCargo);
    for (const p of pagos) await this.recalcularPago(m, Number(p.idPago));
  }

  /**
   * Liquida el saldo completo de un cargo con un pago nuevo por ese saldo (equivale a
   * "marcar pagada"). Para cargos con total 0 sólo deja la marca de pagado.
   */
  async liquidarCargo(
    m: EntityManager,
    idCargo: number,
    opciones: {
      idUsuario?: number | null;
      fechaPago?: Date;
      origen?: string;
      idMetodoPago?: number | null;
      comprobanteUrl?: string | null;
      concepto?: string | null;
    } = {},
  ): Promise<number | null> {
    const cargo = await m.findOne(Cargos, { where: { id: idCargo } });
    if (!cargo) throw new NotFoundException(`Cargo ${idCargo} no encontrado.`);
    const conceptos = await m.find(CargoConceptos, { where: { idCargo, estatus: 1 } });
    const aplicaciones = conceptos
      .filter((c) => cents(c.saldo) > 0)
      .map((c) => ({ idCargoConcepto: Number(c.id), monto: c.saldo }));
    if (aplicaciones.length === 0) {
      await m.update(Cargos, idCargo, { marcaPagadoSinMonto: 1 });
      await this.recalcularCargo(m, idCargo);
      return null;
    }
    const monto = aplicaciones.reduce((s, a) => s + cents(a.monto), 0);
    return this.registrarPago(
      m,
      {
        idArrendatario: Number(cargo.idArrendatario),
        fechaPago: opciones.fechaPago ?? new Date(),
        monto: money(monto),
        idMetodoPago: opciones.idMetodoPago ?? null,
        comprobanteUrl: opciones.comprobanteUrl ?? null,
        concepto: opciones.concepto ?? null,
        idCargoReferencia: idCargo,
        origen: opciones.origen ?? "CAPTURA",
        idUsuario: opciones.idUsuario ?? null,
      },
      aplicaciones,
    );
  }

  async recalcularPago(m: EntityManager, idPago: number): Promise<void> {
    const [row] = await m.query(
      `SELECT p.Monto AS monto, p.Estatus AS estatus,
              COALESCE((SELECT SUM(pa.Monto) FROM PagoAplicaciones pa WHERE pa.IdPago = p.Id AND pa.Estatus = 1), 0) AS aplicado
         FROM Pagos p WHERE p.Id = ?`,
      [idPago],
    );
    if (!row) return;
    const aplicado = cents(row.aplicado);
    const disponible =
      Number(row.estatus) === PagoRecibidoEstatus.Confirmado ? cents(row.monto) - aplicado : 0;
    await m.update(Pagos, idPago, { aplicado: money(aplicado), disponible: money(disponible) });
  }
}

/** Estado de pago visible para el usuario. */
export function estadoPagoCargo(cargo: Pick<Cargos, "liquidado" | "pagado" | "estatus">): string {
  if (Number(cargo.estatus) === 0) return "CANCELADO";
  if (Number(cargo.liquidado) === 1) return "PAGADO";
  return cents(cargo.pagado) > 0 ? "PARCIAL" : "PENDIENTE";
}

export type { ClaseCargo, TipoConceptoCargo };
