import { CargoConceptos } from "src/entities/CargoConceptos";
import { Cargos } from "src/entities/Cargos";
import { PagoRecibidoEstatus, Pagos } from "src/entities/Pagos";
import { estadoPagoCargo } from "./cobranza.service";

/**
 * Capa de compatibilidad: los cargos del modelo nuevo se exponen con la misma forma que
 * `RentaActual`/`HistoricoPagosRenta` y `PagosArrendatarios`, más campos adicionales
 * (`saldo`, `pagado`, `estadoPago`). Así el front y los mapeos existentes no cambian.
 */

export const CARGO_RENTA_RELATIONS = [
  "arrendatario",
  "contrato",
  "contrato.inmueble",
  "contrato.contratoLocales",
  "contrato.contratoLocales.local",
  "formula",
  "conceptos",
] as const;

export const CARGO_SERVICIO_RELATIONS = [
  "arrendatario",
  "conceptos",
  "conceptos.servicioArrendatario",
  "conceptos.servicioArrendatario.tipoServicio",
] as const;

function conceptoVigente(cargo: Cargos, tipo: CargoConceptos["tipo"]): CargoConceptos | undefined {
  return (cargo.conceptos ?? []).find((c) => c.tipo === tipo && Number(c.estatus) === 1);
}

/** Cargo de renta con la forma de `RentaActual`. */
export function toRentaLegacy(cargo: Cargos) {
  const renta = conceptoVigente(cargo, "RENTA");
  const mant = conceptoVigente(cargo, "MANTENIMIENTO");
  return {
    id: Number(cargo.id),
    idArrendatario: Number(cargo.idArrendatario),
    mes: cargo.mes,
    total: renta?.montoBase ?? null,
    idFormula: cargo.idFormula,
    fhRegistro: cargo.fhRegistro,
    montoFinal: renta?.montoFinal ?? null,
    totalMantenimiento: mant?.montoBase ?? null,
    montoFinalMantenimiento: mant?.montoFinal ?? null,
    fechaFin: cargo.fechaFin,
    usaFormula: cargo.usaFormula,
    esPeriodo: cargo.fechaFin ? 1 : 0,
    factorVariable: cargo.factorVariable,
    ocupoFormula: cargo.ocupoFormula,
    idContrato: cargo.idContrato,
    pagada: Number(cargo.liquidado) === 1 ? 1 : 0,
    arrendatario: cargo.arrendatario,
    contrato: cargo.contrato,
    formula: cargo.formula,
    // Campos nuevos (opcionales para el front)
    pagado: cargo.pagado,
    saldo: cargo.saldo,
    estadoPago: estadoPagoCargo(cargo),
  };
}

export type RentaLegacy = ReturnType<typeof toRentaLegacy>;

/** Pago de referencia de un cargo de servicio: el más reciente no cancelado, si existe. */
export function pagoReferencia(pagos: Pagos[]): Pagos | undefined {
  const ordenados = [...pagos].sort((a, b) => Number(b.id) - Number(a.id));
  return ordenados.find((p) => Number(p.estatus) !== PagoRecibidoEstatus.Cancelado) ?? ordenados[0];
}

/** Cargo de servicio con la forma de `PagosArrendatarios`. */
export function toPagoServicioLegacy(cargo: Cargos, pago?: Pagos) {
  const concepto = (cargo.conceptos ?? []).find((c) => Number(c.estatus) === 1) ?? cargo.conceptos?.[0];
  const estatus = Number(cargo.estatus) === 0 ? 0 : Number(cargo.liquidado) === 1 ? 1 : 2;
  return {
    id: Number(cargo.id),
    idArrendatario: Number(cargo.idArrendatario),
    idServicioArrendatario: concepto?.idServicioArrendatario ?? null,
    concepto: cargo.descripcion,
    fechaPago: cargo.mes,
    monto: concepto?.total ?? cargo.total,
    idMetodoPago: pago?.idMetodoPago ?? null,
    estatus,
    fhRegistro: cargo.fhRegistro,
    comprobantePago: pago?.comprobanteUrl ?? null,
    fechaPagoFinal: cargo.fechaFin,
    esPeriodo: cargo.fechaFin ? 1 : 0,
    arrendatario: cargo.arrendatario,
    servicioArrendatario: concepto?.servicioArrendatario ?? null,
    metodoPago: pago?.metodoPago ?? null,
    // Campos nuevos
    pagado: cargo.pagado,
    saldo: cargo.saldo,
    estadoPago: estadoPagoCargo(cargo),
  };
}
