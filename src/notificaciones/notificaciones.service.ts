import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { ServiciosInmuebles } from "src/entities/ServiciosInmuebles";
import {
  ColorAlerta,
  colorPorDiasFaltantes,
  diasFaltantesHasta,
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
  arrendatario: string | null;
  fechaFin: Date;
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
    @InjectRepository(Arrendatarios)
    private readonly arrendatariosRepo: Repository<Arrendatarios>,
  ) {}

  async obtenerNotificaciones(): Promise<NotificacionesResponse> {
    const hoy = new Date();

    const [contratos, servicios, arrendatarios] = await Promise.all([
      this.contratoRepo.find({
        where: {
          estatus: 1,
          fechaTerminoContrato: Not(IsNull()),
        },
        relations: ["inmueble", "arrendatario"],
      }),
      this.serviciosInmueblesRepo.find({
        where: {
          estatus: 1,
          fechaPago: Not(IsNull()),
        },
        relations: ["inmueble", "tipoServicio"],
      }),
      this.arrendatariosRepo.find({
        where: {
          estatus: 1,
          fechaFin: Not(IsNull()),
        },
      }),
    ]);

    const vencimientosRenovacionesContrato = contratos
      .map((c) => this.mapContrato(c, hoy))
      .sort((a, b) => a.diasFaltantes - b.diasFaltantes);

    const pagoServiciosInmuebles = servicios
      .map((s) => this.mapServicioInmueble(s, hoy))
      .sort((a, b) => a.diasFaltantes - b.diasFaltantes);

    const pagosSeguimiento = arrendatarios
      .map((a) => this.mapArrendatario(a, hoy))
      .sort((a, b) => a.diasFaltantes - b.diasFaltantes);

    return {
      vencimientosRenovacionesContrato,
      pagoServiciosInmuebles,
      pagosSeguimiento,
    };
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
    const dias = diasFaltantesHasta(s.fechaPago!, hoy);
    return {
      id: s.id,
      idInmueble: s.idInmueble,
      idTipoServicio: s.idTipoServicio,
      numeroContrato: s.numeroContrato,
      fechaPago: s.fechaPago!,
      inmueble: s.inmueble?.inmueble ?? null,
      tipoServicio: s.tipoServicio?.nombre ?? null,
      diasFaltantes: dias,
      color: colorPorDiasFaltantes(dias),
    };
  }

  private mapArrendatario(
    a: Arrendatarios,
    hoy: Date,
  ): NotificacionPagoSeguimiento {
    const dias = diasFaltantesHasta(a.fechaFin!, hoy);
    return {
      id: a.id,
      arrendatario: a.arrendatario,
      fechaFin: a.fechaFin!,
      diasFaltantes: dias,
      color: colorPorDiasFaltantes(dias),
    };
  }
}
