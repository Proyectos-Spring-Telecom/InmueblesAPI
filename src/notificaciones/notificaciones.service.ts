import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PagoEstatus } from "src/common/pago-estatus.enum";
import { Arrendadores } from "src/entities/Arrendadores";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Pago } from "src/entities/Pago";
import { PagosArrendatarios } from "src/entities/PagosArrendatarios";
import { RentaActual } from "src/entities/RentaActual";
import { ServiciosArrendatarios } from "src/entities/ServiciosArrendatarios";
import { ServiciosInmuebles } from "src/entities/ServiciosInmuebles";
import {
  getClienteHijos,
  isSuperAdmin,
} from "src/utils/cliente-utils";
import {
  ColorAlerta,
  colorPorDiasFaltantes,
  diasFaltantesHasta,
  fechaPagoParaNotificacion,
} from "./utils/notificacion-color.util";

/** Renta / mantenimiento: el pago del mes se evalúa en RentaActual por IdContrato. */
const TIPOS_SERVICIO_RENTA_ACTUAL = new Set([3, 4]);

export interface NotificacionVencimientoContrato {
  id: number;
  idInmueble: number | null;
  idArrendatario: number | null;
  fechaTerminoContrato: Date;
  inmueble: string | null;
  arrendatario: string | null;
  diasFaltantes: number;
  color: ColorAlerta;
}

export interface NotificacionPagoServicioInmueble {
  id: number;
  idInmueble: number | null;
  idTipoServicio: number | null;
  numeroContrato: string | null;
  fechaPago: Date;
  inmueble: string | null;
  tipoServicio: string | null;
  /** Estatus del Pago del mes: 2 Pendiente, 1 Pagado; null si no hay / no aplica. */
  estatusPago: number | null;
  diasFaltantes: number;
  color: ColorAlerta;
}

export interface NotificacionPagoSeguimiento {
  id: number;
  idArrendatario: number | null;
  idContrato: number | null;
  idTipoServicio: number | null;
  numeroContrato: string | null;
  fechaPago: Date;
  arrendatario: string | null;
  tipoServicio: string | null;
  /** 2 Pendiente, 1 Pagado; null si no hay / no aplica al mes mostrado. */
  estatusPago: number | null;
  diasFaltantes: number;
  color: ColorAlerta;
}

export interface NotificacionesResponse {
  vencimientosRenovacionesContrato: NotificacionVencimientoContrato[];
  pagoServiciosInmuebles: NotificacionPagoServicioInmueble[];
  pagosSeguimiento: NotificacionPagoSeguimiento[];
}

@Injectable()
export class NotificacionesService {
  constructor(
    @InjectRepository(ContratoArrendatarios)
    private readonly contratoRepo: Repository<ContratoArrendatarios>,
    @InjectRepository(ServiciosInmuebles)
    private readonly serviciosInmueblesRepo: Repository<ServiciosInmuebles>,
    @InjectRepository(ServiciosArrendatarios)
    private readonly serviciosArrendatariosRepo: Repository<ServiciosArrendatarios>,
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    @InjectRepository(PagosArrendatarios)
    private readonly pagosArrendatariosRepo: Repository<PagosArrendatarios>,
    @InjectRepository(RentaActual)
    private readonly rentaActualRepo: Repository<RentaActual>,
    @InjectRepository(Arrendadores)
    private readonly arrendadoresRepo: Repository<Arrendadores>,
  ) {}

  async obtenerNotificaciones(
    idCliente: number,
    rol: number,
  ): Promise<NotificacionesResponse> {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = hoy.getMonth() + 1;
    const arrendadorIds = await this.resolveArrendadorIds(rol, idCliente);

    if (arrendadorIds !== null && arrendadorIds.length === 0) {
      return {
        vencimientosRenovacionesContrato: [],
        pagoServiciosInmuebles: [],
        pagosSeguimiento: [],
      };
    }

    const [contratos, serviciosInmueble, serviciosArrendatario] =
      await Promise.all([
        this.findContratos(arrendadorIds),
        this.findServiciosInmuebles(arrendadorIds),
        this.findServiciosArrendatarios(arrendadorIds),
      ]);

    const idsServiciosInmueble = serviciosInmueble.map((s) => s.id);
    const serviciosOtros = serviciosArrendatario.filter(
      (s) => !TIPOS_SERVICIO_RENTA_ACTUAL.has(Number(s.idTipoServicio)),
    );
    const idsServiciosOtros = serviciosOtros.map((s) => s.id);
    const idsContratoRenta = [
      ...new Set(
        serviciosArrendatario
          .filter((s) => TIPOS_SERVICIO_RENTA_ACTUAL.has(Number(s.idTipoServicio)))
          .map((s) => Number(s.idContrato))
          .filter((id) => !Number.isNaN(id) && id > 0),
      ),
    ];

    const [estatusInmueble, estatusOtros, estatusRenta] = await Promise.all([
      this.findEstatusPagoInmuebleMes(idsServiciosInmueble, anio, mes),
      this.findEstatusPagoArrendatarioMes(idsServiciosOtros, anio, mes),
      this.findEstatusRentaActualMes(idsContratoRenta, anio, mes),
    ]);

    const vencimientosRenovacionesContrato = contratos
      .map((c) => this.mapContrato(c, hoy))
      .sort((a, b) => a.diasFaltantes - b.diasFaltantes);

    const pagoServiciosInmuebles = serviciosInmueble
      .map((s) =>
        this.mapServicioInmueble(
          s,
          hoy,
          estatusInmueble.get(Number(s.id)) ?? null,
        ),
      )
      .sort((a, b) => a.diasFaltantes - b.diasFaltantes);

    const pagosSeguimiento = serviciosArrendatario
      .map((s) => {
        const tipo = Number(s.idTipoServicio);
        let estatus: number | null = null;
        if (TIPOS_SERVICIO_RENTA_ACTUAL.has(tipo)) {
          const idContrato = s.idContrato != null ? Number(s.idContrato) : null;
          estatus =
            idContrato != null ? (estatusRenta.get(idContrato) ?? null) : null;
        } else {
          estatus = estatusOtros.get(Number(s.id)) ?? null;
        }
        return this.mapServicioArrendatario(s, hoy, estatus);
      })
      .sort((a, b) => a.diasFaltantes - b.diasFaltantes);

    return {
      vencimientosRenovacionesContrato,
      pagoServiciosInmuebles,
      pagosSeguimiento,
    };
  }

  private async resolveArrendadorIds(
    rol: number,
    idCliente: number,
  ): Promise<number[] | null> {
    if (isSuperAdmin(rol)) return null;
    const { ids } = await getClienteHijos(this.arrendadoresRepo, idCliente);
    return ids;
  }

  private async findContratos(arrendadorIds: number[] | null) {
    const qb = this.contratoRepo
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.inmueble", "inmueble")
      .leftJoinAndSelect("c.arrendatario", "arrendatario")
      .where("c.estatus = :estatus", { estatus: 1 })
      .andWhere("c.fechaTerminoContrato IS NOT NULL");

    if (arrendadorIds) {
      qb.andWhere(
        "(inmueble.idArrendador IN (:...ids) OR arrendatario.idArrendador IN (:...ids))",
        { ids: arrendadorIds },
      );
    }

    return qb.getMany();
  }

  private async findServiciosInmuebles(arrendadorIds: number[] | null) {
    const qb = this.serviciosInmueblesRepo
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.inmueble", "inmueble")
      .leftJoinAndSelect("s.tipoServicio", "tipoServicio")
      .where("s.estatus = :estatus", { estatus: 1 })
      .andWhere("s.fechaPago IS NOT NULL");

    if (arrendadorIds) {
      qb.andWhere("inmueble.idArrendador IN (:...ids)", { ids: arrendadorIds });
    }

    return qb.getMany();
  }

  private async findServiciosArrendatarios(arrendadorIds: number[] | null) {
    const qb = this.serviciosArrendatariosRepo
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.arrendatario", "arrendatario")
      .leftJoinAndSelect("s.tipoServicio", "tipoServicio")
      .where("s.estatus = :estatus", { estatus: 1 })
      .andWhere("s.fechaPago IS NOT NULL");

    if (arrendadorIds) {
      qb.andWhere("arrendatario.idArrendador IN (:...ids)", {
        ids: arrendadorIds,
      });
    }

    return qb.getMany();
  }

  private async findEstatusPagoInmuebleMes(
    idsServicio: number[],
    anio: number,
    mes: number,
  ): Promise<Map<number, number>> {
    if (idsServicio.length === 0) return new Map();

    const rows = await this.pagoRepo
      .createQueryBuilder("pago")
      .select("pago.idServicioInmueble", "idServicio")
      .addSelect("pago.estatus", "estatus")
      .where("pago.idServicioInmueble IN (:...ids)", { ids: idsServicio })
      .andWhere("pago.estatus IN (:...estatus)", {
        estatus: [PagoEstatus.Pagado, PagoEstatus.Pendiente],
      })
      .andWhere("YEAR(pago.fechaPago) = :anio", { anio })
      .andWhere("MONTH(pago.fechaPago) = :mes", { mes })
      .getRawMany<{ idServicio: string; estatus: string }>();

    return this.mergeEstatusPago(rows);
  }

  private async findEstatusPagoArrendatarioMes(
    idsServicio: number[],
    anio: number,
    mes: number,
  ): Promise<Map<number, number>> {
    if (idsServicio.length === 0) return new Map();

    const rows = await this.pagosArrendatariosRepo
      .createQueryBuilder("pago")
      .select("pago.idServicioArrendatario", "idServicio")
      .addSelect("pago.estatus", "estatus")
      .where("pago.idServicioArrendatario IN (:...ids)", { ids: idsServicio })
      .andWhere("pago.estatus IN (:...estatus)", {
        estatus: [PagoEstatus.Pagado, PagoEstatus.Pendiente],
      })
      .andWhere("YEAR(pago.fechaPago) = :anio", { anio })
      .andWhere("MONTH(pago.fechaPago) = :mes", { mes })
      .getRawMany<{ idServicio: string; estatus: string }>();

    return this.mergeEstatusPago(rows);
  }

  /**
   * Estatus por IdContrato desde RentaActual del mes:
   * Pagada=1 → Pagado, Pagada=0 → Pendiente.
   */
  private async findEstatusRentaActualMes(
    idsContrato: number[],
    anio: number,
    mes: number,
  ): Promise<Map<number, number>> {
    if (idsContrato.length === 0) return new Map();

    const rows = await this.rentaActualRepo
      .createQueryBuilder("r")
      .select("r.idContrato", "idContrato")
      .addSelect("r.pagada", "pagada")
      .where("r.idContrato IN (:...ids)", { ids: idsContrato })
      .andWhere("YEAR(r.mes) = :anio", { anio })
      .andWhere("MONTH(r.mes) = :mes", { mes })
      .getRawMany<{ idContrato: string; pagada: string }>();

    const map = new Map<number, number>();
    for (const row of rows) {
      const idContrato = Number(row.idContrato);
      const pagada = Number(row.pagada) === 1;
      const estatus = pagada ? PagoEstatus.Pagado : PagoEstatus.Pendiente;
      const actual = map.get(idContrato);
      if (actual === undefined || estatus === PagoEstatus.Pagado) {
        map.set(idContrato, estatus);
      }
    }
    return map;
  }

  private mergeEstatusPago(
    rows: Array<{ idServicio: string; estatus: string }>,
  ): Map<number, number> {
    const map = new Map<number, number>();
    for (const row of rows) {
      const id = Number(row.idServicio);
      const estatus = Number(row.estatus);
      const actual = map.get(id);
      if (actual === undefined || estatus === PagoEstatus.Pagado) {
        map.set(id, estatus);
      }
    }
    return map;
  }

  private mapContrato(
    c: ContratoArrendatarios,
    hoy: Date,
  ): NotificacionVencimientoContrato {
    const dias = diasFaltantesHasta(c.fechaTerminoContrato!, hoy);
    return {
      id: c.id,
      idInmueble: c.idInmueble,
      idArrendatario: c.idArrendatario,
      fechaTerminoContrato: c.fechaTerminoContrato!,
      inmueble: c.inmueble?.inmueble ?? null,
      arrendatario: c.arrendatario?.arrendatario ?? null,
      diasFaltantes: dias,
      color: colorPorDiasFaltantes(dias),
    };
  }

  private mapServicioInmueble(
    s: ServiciosInmuebles,
    hoy: Date,
    estatusPago: number | null,
  ): NotificacionPagoServicioInmueble {
    const tienePagoPagado = estatusPago === PagoEstatus.Pagado;
    const fechaPago = fechaPagoParaNotificacion(
      s.fechaPago!,
      hoy,
      tienePagoPagado,
    );
    const avanzoMesSiguiente =
      tienePagoPagado &&
      (fechaPago.getUTCMonth() !== hoy.getMonth() ||
        fechaPago.getUTCFullYear() !== hoy.getFullYear());
    const estatusMostrado = avanzoMesSiguiente ? null : estatusPago;
    const dias = diasFaltantesHasta(fechaPago, hoy);
    return {
      id: s.id,
      idInmueble: s.idInmueble,
      idTipoServicio: s.idTipoServicio,
      numeroContrato: s.numeroContrato,
      fechaPago,
      inmueble: s.inmueble?.inmueble ?? null,
      tipoServicio: s.tipoServicio?.nombre ?? null,
      estatusPago: estatusMostrado,
      diasFaltantes: dias,
      color: colorPorDiasFaltantes(dias),
    };
  }

  private mapServicioArrendatario(
    s: ServiciosArrendatarios,
    hoy: Date,
    estatusPago: number | null,
  ): NotificacionPagoSeguimiento {
    const tienePagoPagado = estatusPago === PagoEstatus.Pagado;
    const fechaPago = fechaPagoParaNotificacion(
      s.fechaPago!,
      hoy,
      tienePagoPagado,
    );
    const avanzoMesSiguiente =
      tienePagoPagado &&
      (fechaPago.getUTCMonth() !== hoy.getMonth() ||
        fechaPago.getUTCFullYear() !== hoy.getFullYear());
    const estatusMostrado = avanzoMesSiguiente ? null : estatusPago;
    const dias = diasFaltantesHasta(fechaPago, hoy);
    return {
      id: s.id,
      idArrendatario: s.idArrendatario,
      idContrato: s.idContrato != null ? Number(s.idContrato) : null,
      idTipoServicio: s.idTipoServicio,
      numeroContrato: s.numeroContrato,
      fechaPago,
      arrendatario: s.arrendatario?.arrendatario ?? null,
      tipoServicio: s.tipoServicio?.nombre ?? null,
      estatusPago: estatusMostrado,
      diasFaltantes: dias,
      color: colorPorDiasFaltantes(dias),
    };
  }
}
