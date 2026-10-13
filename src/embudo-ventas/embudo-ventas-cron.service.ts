import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EmbudoVentas } from "src/entities/EmbudoVentas";
import {
  ActividadPendienteCorreo,
  MailServiceService,
} from "src/mail-service/mail-service.service";

const ROL_VENDEDOR = 8;
const ZONA = "America/Mexico_City";

const MEDIO_COMUNICACION: Record<number, string> = {
  1: "Llamada",
  2: "Correo",
  3: "Visita",
};

type ActividadRow = {
  idUsuario: number;
  correo: string;
  nombre: string | null;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  nombreCliente: string | null;
  apellidoPaternoCliente: string | null;
  apellidoMaternoCliente: string | null;
  hora: string;
  medioComunicacion: number;
  comentario: string | null;
};

@Injectable()
export class EmbudoVentasCronService {
  private readonly logger = new Logger(EmbudoVentasCronService.name);

  constructor(
    @InjectRepository(EmbudoVentas)
    private readonly embudoRepository: Repository<EmbudoVentas>,
    private readonly mailService: MailServiceService,
  ) {}

  /** Cada día a las 09:00 (America/Mexico_City) avisa a cada vendedor sus eventos pendientes de ese día. */
  @Cron("0 9 * * *", { timeZone: ZONA })
  async enviarActividadesDelDia() {
    try {
      const enviados = await this.notificarActividadesPendientes();
      this.logger.log(
        `Cron embudo: ${enviados} correo(s) de actividades enviado(s).`,
      );
    } catch (error) {
      this.logger.error(
        "Cron embudo: error al enviar las actividades del día.",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async notificarActividadesPendientes(fecha = fechaMexico()): Promise<number> {
    const rows: ActividadRow[] = await this.embudoRepository.query(
      `
SELECT
  u.Id AS idUsuario,
  u.UserName AS correo,
  u.Nombre AS nombre,
  u.ApellidoPaterno AS apellidoPaterno,
  u.ApellidoMaterno AS apellidoMaterno,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  DATE_FORMAT(ev.FHProximoEvento, '%H:%i') AS hora,
  ev.MedioComunicacion AS medioComunicacion,
  ev.Comentario AS comentario
FROM EventosEmbudoVentas ev
INNER JOIN EmbudoVentas e ON e.Id = ev.IdEmbudoVentas
INNER JOIN Usuarios u ON u.Id = e.IdUsuario
INNER JOIN Clientes c ON c.Id = e.IdCliente
WHERE ev.Estatus = 0
  AND u.IdRol = ?
  AND u.Estatus = 1
  AND DATE(ev.FHProximoEvento) = ?
ORDER BY u.Id ASC, ev.FHProximoEvento ASC;
      `,
      [ROL_VENDEDOR, fecha],
    );

    const porVendedor = new Map<number, ActividadRow[]>();
    for (const row of rows) {
      const lista = porVendedor.get(Number(row.idUsuario)) ?? [];
      lista.push(row);
      porVendedor.set(Number(row.idUsuario), lista);
    }

    let enviados = 0;
    for (const actividades of porVendedor.values()) {
      const vendedor = actividades[0];
      const correo = (vendedor.correo ?? "").trim();
      if (!correo.includes("@")) {
        this.logger.warn(
          `Cron embudo: el vendedor ${vendedor.idUsuario} no tiene un correo válido.`,
        );
        continue;
      }

      const pendientes: ActividadPendienteCorreo[] = actividades.map((actividad) => ({
        hora: actividad.hora,
        prospecto:
          nombreCompleto(
            actividad.nombreCliente,
            actividad.apellidoPaternoCliente,
            actividad.apellidoMaternoCliente,
          ) ?? "Prospecto",
        medio: MEDIO_COMUNICACION[Number(actividad.medioComunicacion)] ?? "Actividad",
        comentario: actividad.comentario,
      }));

      try {
        await this.mailService.sendActividadesDelDia(
          correo,
          nombreCompleto(
            vendedor.nombre,
            vendedor.apellidoPaterno,
            vendedor.apellidoMaterno,
          ) ?? correo,
          formatearFecha(fecha),
          pendientes,
        );
        enviados += 1;
      } catch (error) {
        this.logger.error(
          `Cron embudo: no se pudo enviar el correo a ${correo}.`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return enviados;
  }

  async enviarCorreoPrueba(): Promise<{ status: string; message: string }> {
    const destino = "luisnm93@gmail.com";
    const fecha = fechaMexico();
    await this.mailService.sendActividadesDelDia(destino, "Luis", formatearFecha(fecha), [
      {
        hora: "10:00",
        prospecto: "Juan Miguel Gómez",
        medio: "Llamada",
        comentario: "Seguimiento de la cotización del local",
      },
      {
        hora: "12:30",
        prospecto: "Elena Patricia Núñez",
        medio: "Visita",
        comentario: "Recorrido del local comercial",
      },
      {
        hora: "16:00",
        prospecto: "Ricardo Alonso Peña",
        medio: "Correo",
        comentario: "Enviar la propuesta de renta",
      },
    ]);
    return {
      status: "success",
      message: `Correo de prueba enviado a ${destino}.`,
    };
  }
}

function fechaMexico(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function nombreCompleto(
  ...partes: Array<string | null | undefined>
): string | null {
  const nombre = partes
    .map((parte) => (parte ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return nombre || null;
}
