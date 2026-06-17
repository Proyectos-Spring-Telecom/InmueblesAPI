import { PagoEstatus } from "src/common/pago-estatus.enum";
import { LocalesEstatus } from "src/common/locales-estatus.enum";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { Clientes } from "src/entities/Clientes";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Inmuebles } from "src/entities/Inmuebles";
import { LocalesZonaInmueble } from "src/entities/LocalesZonaInmueble";
import { Pago } from "src/entities/Pago";
import { PagosArrendatarios } from "src/entities/PagosArrendatarios";
import { RentaActual } from "src/entities/RentaActual";
import { ZonasInmuebles } from "src/entities/ZonasInmuebles";

export interface InmuebleDashboardReducedInput {
  inmueble: Inmuebles;
  zonas: ZonasInmuebles[];
  contratos: ContratoArrendatarios[];
  arrendatarios: Arrendatarios[];
  rentaActual: RentaActual[];
  pagosArrendatarios: PagosArrendatarios[];
  pagosInmueble: Pago[];
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function toDateString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

function clienteNombre(cliente: Clientes | null | undefined): string | null {
  if (!cliente) return null;
  const parts = [
    cliente.nombre,
    cliente.apellidoPaterno,
    cliente.apellidoMaterno,
  ].filter((p) => p != null && String(p).trim() !== "");
  return parts.length > 0 ? parts.join(" ") : null;
}

function mapInmuebleEstado(estatus: number | null | undefined): "activo" | "inactivo" {
  return estatus === 1 ? "activo" : "inactivo";
}

function mapLocalEstado(
  estatus: number | null | undefined,
): "libre" | "ocupado" | null {
  if (estatus === LocalesEstatus.Disponible) return "libre";
  if (estatus === LocalesEstatus.Ocupado || estatus === LocalesEstatus.Apartado) {
    return "ocupado";
  }
  return null;
}

function mapPagoEstatusText(estatus: number | null | undefined): string | null {
  if (estatus === PagoEstatus.Pagado) return "Pagado";
  if (estatus === PagoEstatus.Pendiente) return "Pendiente";
  if (estatus === PagoEstatus.Cancelado) return "Cancelado";
  return estatus == null ? null : "Desconocido";
}

function pickContratoActivo(
  contratos: ContratoArrendatarios[],
): ContratoArrendatarios | null {
  if (contratos.length === 0) return null;

  const activos = contratos.filter((c) => c.estatus === 1);
  const pool = activos.length > 0 ? activos : contratos;

  return [...pool].sort((a, b) => {
    const fa = a.fechaInicioContrato
      ? new Date(a.fechaInicioContrato).getTime()
      : 0;
    const fb = b.fechaInicioContrato
      ? new Date(b.fechaInicioContrato).getTime()
      : 0;
    return fb - fa || Number(b.id) - Number(a.id);
  })[0];
}

function pickRentaDelMes(
  rentas: RentaActual[],
  idContrato: number | null,
): RentaActual | null {
  if (rentas.length === 0) return null;

  const porContrato =
    idContrato != null
      ? rentas.filter((r) => Number(r.idContrato) === Number(idContrato))
      : [];

  const pool = porContrato.length > 0 ? porContrato : rentas;

  return [...pool].sort((a, b) => {
    const fa = a.fhRegistro ? new Date(a.fhRegistro).getTime() : 0;
    const fb = b.fhRegistro ? new Date(b.fhRegistro).getTime() : 0;
    return fb - fa || Number(b.id) - Number(a.id);
  })[0];
}

function mapLocalResumido(local: LocalesZonaInmueble) {
  return {
    id: local.id,
    nombre: local.nombre ?? null,
    areaM2: toNumber(local.areaM2),
    giro: local.giro ?? null,
    estado: mapLocalEstado(local.estatus),
    mensualidadBase: toNumber(local.mensualidad),
  };
}

function mapContratoActivo(contrato: ContratoArrendatarios | null) {
  if (!contrato) return null;

  return {
    id: contrato.id,
    fechaInicio: toDateString(contrato.fechaInicioContrato),
    fechaFin: toDateString(contrato.fechaTerminoContrato),
    moneda: contrato.moneda ?? null,
    rentaTotal: toNumber(contrato.rentaTotal),
    mantenimientoTotal: toNumber(contrato.mantenimientoTotal),
    montoDeposito: toNumber(contrato.montoDeposito),
    montoAdelanto: toNumber(contrato.montoAdelanto),
  };
}

function mapRentaDelMes(renta: RentaActual | null) {
  if (!renta) return null;

  return {
    mes: toDateString(renta.mes),
    montoRenta: toNumber(renta.montoFinal ?? renta.total),
    montoMantenimiento: toNumber(
      renta.montoFinalMantenimiento ?? renta.totalMantenimiento,
    ),
    factorAplicado: toNumber(renta.factorVariable),
    formulaUsada: renta.formula?.nombre ?? null,
    pagada: renta.pagada === 1,
  };
}

function mapPagoResumido(pago: {
  concepto?: string | null;
  monto?: string | null;
  fechaPago?: Date | null;
  estatus?: number | null;
}) {
  return {
    concepto: pago.concepto ?? null,
    monto: toNumber(pago.monto),
    fecha: toDateString(pago.fechaPago),
    estatus: mapPagoEstatusText(pago.estatus),
  };
}

function localesAsignadosNombres(contrato: ContratoArrendatarios | null): string[] {
  if (!contrato?.contratoLocales?.length) return [];

  return contrato.contratoLocales
    .map((cl) => cl.local?.nombre)
    .filter((nombre): nombre is string => nombre != null && nombre.trim() !== "");
}

export function mapInmuebleDashboardReduced(
  input: InmuebleDashboardReducedInput,
) {
  const { inmueble, zonas, contratos, arrendatarios, rentaActual, pagosArrendatarios, pagosInmueble } =
    input;

  const arrendador = inmueble.arrendador ?? null;

  const zonasMapeadas = zonas.map((zona) => ({
    id: zona.id,
    nombre: zona.zonaPrincipal ?? null,
    superficieTotalM2: toNumber(zona.superficieZonaM2),
    superficieDisponibleM2: toNumber(zona.superficieDisponibleM2),
    locales: (zona.locales ?? []).map(mapLocalResumido),
  }));

  const todosLosLocales = zonasMapeadas.flatMap((zona) => zona.locales);
  const localesConEstado = todosLosLocales.filter(
    (local) => local.estado === "libre" || local.estado === "ocupado",
  );

  const contratosByArrendatario = new Map<number, ContratoArrendatarios[]>();
  for (const contrato of contratos) {
    if (contrato.idArrendatario == null) continue;
    const id = Number(contrato.idArrendatario);
    const bucket = contratosByArrendatario.get(id) ?? [];
    bucket.push(contrato);
    contratosByArrendatario.set(id, bucket);
  }

  const rentaByArrendatario = new Map<number, RentaActual[]>();
  for (const renta of rentaActual) {
    if (renta.idArrendatario == null) continue;
    const id = Number(renta.idArrendatario);
    const bucket = rentaByArrendatario.get(id) ?? [];
    bucket.push(renta);
    rentaByArrendatario.set(id, bucket);
  }

  const pagosByArrendatario = new Map<number, PagosArrendatarios[]>();
  for (const pago of pagosArrendatarios) {
    if (pago.idArrendatario == null) continue;
    const id = Number(pago.idArrendatario);
    const bucket = pagosByArrendatario.get(id) ?? [];
    bucket.push(pago);
    pagosByArrendatario.set(id, bucket);
  }

  const arrendatariosMapeados = arrendatarios.map((arrendatario) => {
    const contratosArrendatario =
      contratosByArrendatario.get(arrendatario.id) ?? [];
    const contratoActivo = pickContratoActivo(contratosArrendatario);
    const rentasArrendatario = rentaByArrendatario.get(arrendatario.id) ?? [];
    const rentaMes = pickRentaDelMes(
      rentasArrendatario,
      contratoActivo?.id ?? null,
    );
    const pagosRecientes = (pagosByArrendatario.get(arrendatario.id) ?? []).map(
      mapPagoResumido,
    );

    return {
      id: arrendatario.id,
      nombre: arrendatario.arrendatario ?? null,
      rfc: arrendatario.rfc ?? null,
      representanteLegal: arrendatario.representanteLegal ?? null,
      telefono: arrendatario.telefonoRepresentante ?? null,
      correo: arrendatario.correoRepresentante ?? null,
      localesAsignados: localesAsignadosNombres(contratoActivo),
      contratoActivo: mapContratoActivo(contratoActivo),
      rentaDelMes: mapRentaDelMes(rentaMes),
      pagosRecientes,
    };
  });

  return {
    inmueble: {
      id: inmueble.id,
      nombre: inmueble.inmueble ?? null,
      direccionFiscal: inmueble.direccionFiscal ?? null,
      totalM2: toNumber(inmueble.totalM2),
      estado: mapInmuebleEstado(inmueble.estatus),
    },
    arrendador: arrendador
      ? {
          id: arrendador.id,
          nombre: clienteNombre(arrendador),
          telefono: arrendador.telefono ?? null,
          correo: arrendador.correo ?? null,
          encargado: {
            nombre: arrendador.nombreEncargado ?? null,
            telefono: arrendador.telefonoEncargado ?? null,
            correo: arrendador.correoEncargado ?? null,
          },
        }
      : null,
    zonas: zonasMapeadas,
    resumenOcupacion: {
      totalLocales: localesConEstado.length,
      localesOcupados: localesConEstado.filter((l) => l.estado === "ocupado")
        .length,
      localesLibres: localesConEstado.filter((l) => l.estado === "libre").length,
      ingresoMensualEstimado: localesConEstado
        .filter((l) => l.estado === "ocupado")
        .reduce((sum, l) => sum + (l.mensualidadBase ?? 0), 0),
    },
    arrendatarios: arrendatariosMapeados,
    pagosInmueble: pagosInmueble.map(mapPagoResumido),
  };
}
