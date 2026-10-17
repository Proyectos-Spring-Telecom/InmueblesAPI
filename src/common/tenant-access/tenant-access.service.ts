import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { isSuperAdmin } from 'src/utils/cliente-utils';

/**
 * Consulta que devuelve una fila si el recurso pertenece a un arrendador del cliente.
 * Parámetros: [id del recurso, id del cliente del JWT].
 */
const PERTENENCIA_SQL = {
  arrendador: `SELECT a.Id FROM Arrendadores a WHERE a.Id = ? AND a.IdCliente = ?`,
  inmueble: `SELECT i.Id FROM Inmuebles i
    JOIN Arrendadores a ON a.Id = i.IdArrendador
    WHERE i.Id = ? AND a.IdCliente = ?`,
  zona: `SELECT z.Id FROM ZonasInmuebles z
    JOIN Inmuebles i ON i.Id = z.IdInmueble
    JOIN Arrendadores a ON a.Id = i.IdArrendador
    WHERE z.Id = ? AND a.IdCliente = ?`,
  local: `SELECT l.Id FROM LocalesZonaInmueble l
    JOIN ZonasInmuebles z ON z.Id = l.IdZona
    JOIN Inmuebles i ON i.Id = z.IdInmueble
    JOIN Arrendadores a ON a.Id = i.IdArrendador
    WHERE l.Id = ? AND a.IdCliente = ?`,
  arrendatario: `SELECT t.Id FROM Arrendatarios t
    JOIN Arrendadores a ON a.Id = t.IdArrendador
    WHERE t.Id = ? AND a.IdCliente = ?`,
  contrato: `SELECT c.Id FROM ContratoArrendatarios c
    JOIN Arrendatarios t ON t.Id = c.IdArrendatario
    JOIN Arrendadores a ON a.Id = t.IdArrendador
    WHERE c.Id = ? AND a.IdCliente = ?`,
  mantenimientoActual: `SELECT m.Id FROM MantenimientoActual m
    JOIN Arrendatarios t ON t.Id = m.IdArrendatario
    JOIN Arrendadores a ON a.Id = t.IdArrendador
    WHERE m.Id = ? AND a.IdCliente = ?`,
  historicoPagoMantenimiento: `SELECT h.Id FROM HistoricoPagosMantenimiento h
    JOIN Arrendatarios t ON t.Id = h.IdArrendatario
    JOIN Arrendadores a ON a.Id = t.IdArrendador
    WHERE h.Id = ? AND a.IdCliente = ?`,
  pagoInmueble: `SELECT p.Id FROM Pago p
    JOIN Inmuebles i ON i.Id = p.IdInmueble
    JOIN Arrendadores a ON a.Id = i.IdArrendador
    WHERE p.Id = ? AND a.IdCliente = ?`,
  estacionamiento: `SELECT e.Id FROM Estacionamientos e
    JOIN Inmuebles i ON i.Id = e.IdInmueble
    JOIN Arrendadores a ON a.Id = i.IdArrendador
    WHERE e.Id = ? AND a.IdCliente = ?`,
  servicioInmueble: `SELECT s.Id FROM ServiciosInmuebles s
    JOIN Inmuebles i ON i.Id = s.IdInmueble
    JOIN Arrendadores a ON a.Id = i.IdArrendador
    WHERE s.Id = ? AND a.IdCliente = ?`,
  archivoInmueble: `SELECT f.Id FROM ArchivosInmuebles f
    JOIN Inmuebles i ON i.Id = f.IdInmueble
    JOIN Arrendadores a ON a.Id = i.IdArrendador
    WHERE f.Id = ? AND a.IdCliente = ?`,
  servicioArrendatario: `SELECT s.Id FROM ServiciosArrendatarios s
    JOIN Arrendatarios t ON t.Id = s.IdArrendatario
    JOIN Arrendadores a ON a.Id = t.IdArrendador
    WHERE s.Id = ? AND a.IdCliente = ?`,
  socioArrendatario: `SELECT s.Id FROM SociosArrendatarios s
    JOIN Arrendatarios t ON t.Id = s.IdArrendatario
    JOIN Arrendadores a ON a.Id = t.IdArrendador
    WHERE s.Id = ? AND a.IdCliente = ?`,
  archivoArrendatario: `SELECT f.Id FROM ArchivosArrendatarios f
    JOIN Arrendatarios t ON t.Id = f.IdArrendatario
    JOIN Arrendadores a ON a.Id = t.IdArrendador
    WHERE f.Id = ? AND a.IdCliente = ?`,
  /** SociosArrendadores.IdCliente apunta a Arrendadores.Id. */
  socioArrendador: `SELECT s.Id FROM SociosArrendadores s
    JOIN Arrendadores a ON a.Id = s.IdCliente
    WHERE s.Id = ? AND a.IdCliente = ?`,
  contratoLocal: `SELECT cl.Id FROM ContratoLocales cl
    JOIN ContratoArrendatarios c ON c.Id = cl.IdContrato
    JOIN Arrendatarios t ON t.Id = c.IdArrendatario
    JOIN Arrendadores a ON a.Id = t.IdArrendador
    WHERE cl.Id = ? AND a.IdCliente = ?`,
  /** Cargo del modelo de cobranza (renta, mantenimiento o servicio). */
  cargo: `SELECT c.Id FROM Cargos c
    JOIN Arrendatarios t ON t.Id = c.IdArrendatario
    JOIN Arrendadores a ON a.Id = t.IdArrendador
    WHERE c.Id = ? AND a.IdCliente = ?`,
  /** Pago recibido del modelo de cobranza. */
  pago: `SELECT p.Id FROM Pagos p
    JOIN Arrendatarios t ON t.Id = p.IdArrendatario
    JOIN Arrendadores a ON a.Id = t.IdArrendador
    WHERE p.Id = ? AND a.IdCliente = ?`,
  /** Plantillas guardadas: pertenecen al cliente del usuario que las generó. */
  contratoGenerado: `SELECT g.Id FROM ContratosGenerados g
    JOIN Usuarios u ON u.Id = g.IdUsuario
    WHERE g.Id = ? AND u.IdCliente = ?`,
  /** Por número de serie (incidencias). Equipos.IdCliente apunta a Arrendadores.Id. */
  dispositivo: `SELECT e.Id FROM Equipos e
    JOIN Arrendadores a ON a.Id = e.IdCliente
    WHERE e.NumeroSerie = ? AND a.IdCliente = ?`,
} as const;

export type RecursoCliente = keyof typeof PERTENENCIA_SQL;

export interface UsuarioJwt {
  userId?: number;
  cliente?: number;
  rol?: number;
}

/**
 * Valida que un recurso pedido por id pertenezca al cliente del JWT. El súper
 * administrador (rol 1) no tiene restricción. Si no pertenece se responde 404,
 * igual que si no existiera, para no revelar datos de otros clientes.
 */
@Injectable()
export class TenantAccessService {
  constructor(private readonly dataSource: DataSource) {}

  async assert(
    recurso: RecursoCliente,
    id: number | string | null | undefined,
    user: UsuarioJwt | undefined,
  ): Promise<void> {
    if (isSuperAdmin(Number(user?.rol))) return;
    if (id === null || id === undefined || id === '') return; // parámetro opcional ausente

    const cliente = Number(user?.cliente) || 0;
    const rows = await this.dataSource.query(`${PERTENENCIA_SQL[recurso]} LIMIT 1`, [id, cliente]);
    if (!rows?.length) {
      throw new NotFoundException('Recurso no encontrado.');
    }
  }
}
