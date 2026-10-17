import { mapPagoRentaDesglose } from "src/common/pago-mensual.utils";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { LocalesZonaInmueble } from "src/entities/LocalesZonaInmueble";
import { RentaLegacy } from "src/cobranza/cobranza-legacy";
import { PagoServicioLegacy } from "src/cobranza/cobranza-consultas.service";
import { ZonasInmuebles } from "src/entities/ZonasInmuebles";

export function collectLocalesAsignados(
  contratos: ContratoArrendatarios[],
): Set<number> {
  const idLocalesAsignados = new Set<number>();
  for (const contrato of contratos) {
    for (const cl of contrato.contratoLocales ?? []) {
      if (cl.idLocal != null) {
        idLocalesAsignados.add(Number(cl.idLocal));
      }
    }
  }
  return idLocalesAsignados;
}

export function filterZonasConLocales(
  zonasRaw: ZonasInmuebles[],
  idLocalesAsignados: Set<number>,
) {
  return zonasRaw.map((zona) => ({
    ...zona,
    locales: (zona.locales ?? [])
      .filter((local) => idLocalesAsignados.has(local.id))
      .sort((a, b) => a.id - b.id),
  }));
}

export function assembleArrendatarioPanel(
  arrendatario: Arrendatarios,
  contratos: ContratoArrendatarios[],
  zonasRaw: ZonasInmuebles[],
  localesPool: LocalesZonaInmueble[],
  historicoPagosRenta: RentaLegacy[],
  rentaActual: RentaLegacy[],
  pagosArrendatarios: PagoServicioLegacy[],
) {
  const idLocalesAsignados = collectLocalesAsignados(contratos);
  const zonas = filterZonasConLocales(zonasRaw, idLocalesAsignados);
  const locales = localesPool
    .filter((local) => idLocalesAsignados.has(local.id))
    .sort((a, b) => a.id - b.id);

  return {
    arrendatario,
    contratos,
    zonas,
    locales,
    historicoPagosRenta: historicoPagosRenta.map(mapPagoRentaDesglose),
    rentaActual: rentaActual.map(mapPagoRentaDesglose),
    pagosArrendatarios,
  };
}
