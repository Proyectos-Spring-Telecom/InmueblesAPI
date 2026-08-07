import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PagoEstatus } from "src/common/pago-estatus.enum";
import { Arrendadores } from "src/entities/Arrendadores";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Pago } from "src/entities/Pago";
import { PagosArrendatarios } from "src/entities/PagosArrendatarios";
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
  fechaPagoEnMesActual,
} from "./utils/notificacion-color.util";

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
  diasFaltantes: number;
  color: ColorAlerta;
}

export interface NotificacionPagoSeguimiento {
  id: number;
  idArrendatario: number | null;
  idTipoServicio: number | null;
  numeroContrato: string | null;
  fechaPago: Date;
  arrendatario: string | null;
  tipoServicio: string | null;
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
    const idsServiciosArrendatario = serviciosArrendatario.map((s) => s.id);

    const [pagadosInmueble, pagadosArrendatario] = await Promise.all([
      this.findServiciosInmueblePagadosMes(idsServiciosInmueble, anio, mes),
      this.findServiciosArrendatarioPagadosMes(
        idsServiciosArrendatario,
        anio,
        mes,
      ),
    ]);

    const vencimientosRenovacionesContrato = contratos
      .map((c) => this.mapContrato(c, hoy))
      .sort((a, b) => a.diasFaltantes - b.diasFaltantes);

    const pagoServiciosInmuebles = serviciosInmueble
      .filter((s) => !pagadosInmueble.has(Number(s.id)))
      .map((s) => this.mapServicioInmueble(s, hoy))
      .sort((a, b) => a.diasFaltantes - b.diasFaltantes);

    const pagosSeguimiento = serviciosArrendatario
      .filter((s) => !pagadosArrendatario.has(Number(s.id)))
      .map((s) => this.mapServicioArrendatario(s, hoy))
      .sort((a, b) => a.diasFaltantes - b.diasFaltantes);

    return {
      vencimientosRenovacionesContrato,
      pagoServiciosInmuebles,
      pagosSeguimiento,
    };
  }

  /** null = sin restricción (rol 1); array = IDs de arrendadores del cliente. */
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

  /** IDs de ServiciosInmuebles con al menos un Pago Pagado en el mes actual. */
  private async findServiciosInmueblePagadosMes(
    idsServicio: number[],
    anio: number,
    mes: number,
  ): Promise<Set<number>> {
    if (idsServicio.length === 0) return new Set();

    const rows = await this.pagoRepo
      .createQueryBuilder("pago")
      .select("DISTINCT pago.idServicioInmueble", "idServicio")
      .where("pago.idServicioInmueble IN (:...ids)", { ids: idsServicio })
      .andWhere("pago.estatus = :estatus", { estatus: PagoEstatus.Pagado })
      .andWhere("YEAR(pago.fechaPago) = :anio", { anio })
      .andWhere("MONTH(pago.fechaPago) = :mes", { mes })
      .getRawMany<{ idServicio: string }>();

    return new Set(rows.map((r) => Number(r.idServicio)));
  }

  /** IDs de ServiciosArrendatarios con al menos un PagosArrendatarios Pagado en el mes. */
  private async findServiciosArrendatarioPagadosMes(
    idsServicio: number[],
    anio: number,
    mes: number,
  ): Promise<Set<number>> {
    if (idsServicio.length === 0) return new Set();

    const rows = await this.pagosArrendatariosRepo
      .createQueryBuilder("pago")
      .select("DISTINCT pago.idServicioArrendatario", "idServicio")
      .where("pago.idServicioArrendatario IN (:...ids)", { ids: idsServicio })
      .andWhere("pago.estatus = :estatus", { estatus: PagoEstatus.Pagado })
      .andWhere("YEAR(pago.fechaPago) = :anio", { anio })
      .andWhere("MONTH(pago.fechaPago) = :mes", { mes })
      .getRawMany<{ idServicio: string }>();

    return new Set(rows.map((r) => Number(r.idServicio)));
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
  ): NotificacionPagoServicioInmueble {
    const fechaPago = fechaPagoEnMesActual(s.fechaPago!, hoy);
    const dias = diasFaltantesHasta(fechaPago, hoy);
    return {
      id: s.id,
      idInmueble: s.idInmueble,
      idTipoServicio: s.idTipoServicio,
      numeroContrato: s.numeroContrato,
      fechaPago,
      inmueble: s.inmueble?.inmueble ?? null,
      tipoServicio: s.tipoServicio?.nombre ?? null,
      diasFaltantes: dias,
      color: colorPorDiasFaltantes(dias),
    };
  }

  private mapServicioArrendatario(
    s: ServiciosArrendatarios,
    hoy: Date,
  ): NotificacionPagoSeguimiento {
    const fechaPago = fechaPagoEnMesActual(s.fechaPago!, hoy);
    const dias = diasFaltantesHasta(fechaPago, hoy);
    return {
      id: s.id,
      idArrendatario: s.idArrendatario,
      idTipoServicio: s.idTipoServicio,
      numeroContrato: s.numeroContrato,
      fechaPago,
      arrendatario: s.arrendatario?.arrendatario ?? null,
      tipoServicio: s.tipoServicio?.nombre ?? null,
      diasFaltantes: dias,
      color: colorPorDiasFaltantes(dias),
    };
  }
}
