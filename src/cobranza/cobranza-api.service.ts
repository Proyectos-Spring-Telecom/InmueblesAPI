import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { ApiResponseCommon } from "src/common/ApiResponse";
import { EstatusEnumBitcora } from "src/common/estatus.enums";
import { getMesActual } from "src/common/pago-mensual.utils";
import { TenantAccessService, UsuarioJwt } from "src/common/tenant-access/tenant-access.service";
import { BitacoraService } from "src/bitacora/bitacora.service";
import { Cargos } from "src/entities/Cargos";
import { PagoRecibidoEstatus } from "src/entities/Pagos";
import { S3Service } from "src/s3/s3.service";
import { isSuperAdmin } from "src/utils/cliente-utils";
import { CobranzaService, estadoPagoCargo } from "./cobranza.service";
import {
  AplicacionDto,
  CrearCargoDto,
  EstadoCuentaQuery,
  ListarCargosQuery,
  ListarPagosQuery,
  RegistrarPagoDto,
} from "./dto/cobranza.dto";
import { cents, money } from "./money";

const ID_MODULO_ARRENDATARIOS = 15;
const FOLDER_COMPROBANTES = "ComprobantesPagoArrendatarios";

export const ESTATUS_PAGO_TEXTO: Record<number, string> = {
  [PagoRecibidoEstatus.Cancelado]: "CANCELADO",
  [PagoRecibidoEstatus.Confirmado]: "CONFIRMADO",
  [PagoRecibidoEstatus.PorConfirmar]: "POR_CONFIRMAR",
};

/** Usuario del JWT tal como lo deja JwtStrategy (`req.user`). */
export type UsuarioReq = UsuarioJwt & { userId?: number };

/**
 * Operaciones de cobranza expuestas por la API (fase 2): cargos, pagos, aplicaciones,
 * saldo a favor, cancelaciones y estado de cuenta. Todas las lecturas y escrituras pasan por
 * `this.ds` para poder ejecutarse dentro de una misma transacción.
 */
@Injectable()
export class CobranzaApiService {
  private readonly logger = new Logger(CobranzaApiService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly cobranza: CobranzaService,
    private readonly tenant: TenantAccessService,
    @Optional() private readonly s3?: S3Service,
    @Optional() private readonly bitacora?: BitacoraService,
  ) {}

  private get m(): EntityManager {
    return this.ds.manager;
  }

  // ─── Cargos ─────────────────────────────────────────────────────────────────

  async listarCargos(q: ListarCargosQuery, user: UsuarioReq): Promise<ApiResponseCommon> {
    const where: string[] = [];
    const params: unknown[] = [];
    this.alcance(user, where, params);
    if (q.idArrendatario) (where.push("c.IdArrendatario = ?"), params.push(q.idArrendatario));
    if (q.idContrato) (where.push("c.IdContrato = ?"), params.push(q.idContrato));
    if (q.clase) (where.push("c.Clase = ?"), params.push(q.clase));
    if (q.fechaInicio) (where.push("c.Mes >= ?"), params.push(`${q.fechaInicio.slice(0, 10)} 00:00:00`));
    if (q.fechaFin) (where.push("c.Mes <= ?"), params.push(`${q.fechaFin.slice(0, 10)} 23:59:59`));
    const estado: Record<string, string> = {
      PENDIENTE: "c.Estatus = 1 AND c.Liquidado = 0 AND c.Pagado = 0",
      PARCIAL: "c.Estatus = 1 AND c.Liquidado = 0 AND c.Pagado > 0",
      PAGADO: "c.Estatus = 1 AND c.Liquidado = 1",
      CANCELADO: "c.Estatus = 0",
      CON_SALDO: "c.Estatus = 1 AND c.Saldo > 0",
    };
    if (q.estado) where.push(estado[q.estado]);

    const from = `FROM Cargos c
      JOIN Arrendatarios t ON t.Id = c.IdArrendatario
      JOIN Arrendadores a ON a.Id = t.IdArrendador
      LEFT JOIN ContratoArrendatarios ct ON ct.Id = c.IdContrato
      LEFT JOIN Inmuebles i ON i.Id = ct.IdInmueble
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
    const [{ total }] = await this.m.query(`SELECT COUNT(*) AS total ${from}`, params);
    const rows = await this.m.query(
      `SELECT ${CARGO_COLS} ${from} ORDER BY c.Mes DESC, c.Id DESC LIMIT ? OFFSET ?`,
      [...params, q.limit, (q.page - 1) * q.limit],
    );
    const conceptos = await this.conceptosDe(rows.map((r: any) => Number(r.id)));
    return {
      data: rows.map((r: any) => mapCargo(r, conceptos.get(Number(r.id)) ?? [])),
      paginated: { total: Number(total), page: q.page, lastPage: Math.ceil(Number(total) / q.limit) },
    };
  }

  async obtenerCargo(id: number) {
    const [row] = await this.m.query(
      `SELECT ${CARGO_COLS} FROM Cargos c
         JOIN Arrendatarios t ON t.Id = c.IdArrendatario
         LEFT JOIN ContratoArrendatarios ct ON ct.Id = c.IdContrato
         LEFT JOIN Inmuebles i ON i.Id = ct.IdInmueble
        WHERE c.Id = ?`,
      [id],
    );
    if (!row) throw new NotFoundException(`Cargo ${id} no encontrado.`);
    const conceptos = (await this.conceptosDe([id])).get(id) ?? [];
    const aplicaciones = await this.m.query(
      `SELECT pa.Id AS id, pa.IdCargoConcepto AS idCargoConcepto, pa.Monto AS monto, pa.Estatus AS estatus,
              pa.FHRegistro AS fhRegistro, pa.FHAnulacion AS fhAnulacion,
              p.Id AS idPago, p.FechaPago AS fechaPago, p.Monto AS montoPago, p.FormaPagoSat AS formaPagoSat,
              p.Referencia AS referencia, p.Estatus AS estatusPago, mp.Nombre AS metodoPago
         FROM PagoAplicaciones pa
         JOIN CargoConceptos cc ON cc.Id = pa.IdCargoConcepto
         JOIN Pagos p ON p.Id = pa.IdPago
         LEFT JOIN CatMetodosPago mp ON mp.Id = p.IdMetodoPago
        WHERE cc.IdCargo = ?
        ORDER BY pa.Id`,
      [id],
    );
    return {
      ...mapCargo(row, conceptos),
      aplicaciones: aplicaciones.map((a: any) => ({
        id: Number(a.id),
        idCargoConcepto: Number(a.idCargoConcepto),
        monto: money(cents(a.monto)),
        vigente: Number(a.estatus) === 1,
        fhRegistro: a.fhRegistro,
        fhAnulacion: a.fhAnulacion,
        pago: {
          id: Number(a.idPago),
          fechaPago: a.fechaPago,
          monto: money(cents(a.montoPago)),
          metodoPago: a.metodoPago,
          formaPagoSat: a.formaPagoSat,
          referencia: a.referencia,
          estatus: ESTATUS_PAGO_TEXTO[Number(a.estatusPago)],
        },
      })),
    };
  }

  /** Cargo de servicio u otro concepto (los de renta se generan con /renta-actual). */
  async crearCargo(dto: CrearCargoDto, user: UsuarioReq) {
    await this.tenant.assert("arrendatario", dto.idArrendatario, user);
    if (dto.idContrato != null) {
      const [contrato] = await this.m.query(
        `SELECT IdArrendatario, Estatus FROM ContratoArrendatarios WHERE Id = ?`,
        [dto.idContrato],
      );
      if (!contrato) throw new NotFoundException(`Contrato ${dto.idContrato} no encontrado.`);
      if (Number(contrato.IdArrendatario) !== dto.idArrendatario) {
        throw new BadRequestException(`El contrato ${dto.idContrato} no pertenece al arrendatario.`);
      }
      if (Number(contrato.Estatus) === 0) {
        throw new BadRequestException("No se pueden generar cargos nuevos para un contrato cancelado.");
      }
    } else {
      const [activo] = await this.m.query(
        `SELECT Id FROM ContratoArrendatarios WHERE IdArrendatario = ? AND Estatus = 1 LIMIT 1`,
        [dto.idArrendatario],
      );
      if (!activo) {
        throw new BadRequestException("El arrendatario no tiene un contrato activo; no se pueden generar cargos nuevos.");
      }
    }

    const id = await this.ds.transaction((tx) =>
      this.cobranza.crearCargo(tx, {
        idArrendatario: dto.idArrendatario,
        idContrato: dto.idContrato ?? null,
        clase: dto.clase,
        mes: new Date(dto.fecha),
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
        descripcion: dto.descripcion ?? null,
        origen: dto.clase === "SERVICIO" ? "SERVICIO" : "MANUAL",
        idUsuario: user.userId ?? null,
        conceptos: dto.conceptos.map((k) => ({
          tipo: "SERVICIO" as const,
          montoBase: k.total,
          subtotal: k.subtotal ?? null,
          iva: k.iva ?? null,
          idTipoServicio: k.idTipoServicio ?? null,
          idServicioArrendatario: k.idServicioArrendatario ?? null,
          descripcion: k.descripcion ?? dto.descripcion ?? null,
        })),
      }),
    );
    await this.log("Cargos", `Se registró el cargo ${id}`, "CREATE", { id, ...dto }, user);
    return { status: "success", message: "Cargo registrado correctamente.", data: await this.obtenerCargo(id) };
  }

  async cancelarCargo(id: number, motivo: string, user: UsuarioReq) {
    await this.ds.transaction(async (tx) => {
      const cargo = await tx.findOne(Cargos, { where: { id } });
      if (!cargo) throw new NotFoundException(`Cargo ${id} no encontrado.`);
      if (Number(cargo.estatus) === 0) return;
      if (cents(cargo.pagado) > 0) {
        throw new ConflictException(
          "El cargo tiene pagos aplicados. Anule esas aplicaciones o cancele los pagos antes de cancelar el cargo.",
        );
      }
      await tx.update(Cargos, id, { estatus: 0, fhActualizacion: new Date() });
      await this.cobranza.recalcularCargo(tx, id);
    });
    await this.log("Cargos", `Se canceló el cargo ${id}: ${motivo}`, "UPDATE", { id, motivo }, user);
    return { status: "success", message: "Cargo cancelado.", data: await this.obtenerCargo(id) };
  }

  // ─── Pagos ──────────────────────────────────────────────────────────────────

  async registrarPago(dto: RegistrarPagoDto, archivo: Express.Multer.File | undefined, user: UsuarioReq) {
    await this.tenant.assert("arrendatario", dto.idArrendatario, user);
    let formaPagoSat = dto.formaPagoSat ?? null;
    if (dto.idMetodoPago != null) {
      const [metodo] = await this.m.query(`SELECT FormaPagoSat FROM CatMetodosPago WHERE Id = ?`, [dto.idMetodoPago]);
      if (!metodo) throw new NotFoundException(`Método de pago ${dto.idMetodoPago} no encontrado.`);
      formaPagoSat ??= metodo.FormaPagoSat ?? null;
    }
    // La suma aplicada no puede exceder el monto (lo no aplicado queda a favor).
    const aplicaciones = dto.aplicaciones ?? [];
    const aplicado = aplicaciones.reduce((s, a) => s + cents(a.monto), 0);
    if (aplicado > cents(dto.monto)) {
      throw new BadRequestException(`Las aplicaciones (${money(aplicado)}) exceden el monto del pago (${money(cents(dto.monto))}).`);
    }

    let comprobanteUrl: string | null = null;
    if (archivo) {
      if (!this.s3) throw new BadRequestException("El almacenamiento de comprobantes no está disponible.");
      comprobanteUrl = (await this.s3.uploadFile(archivo, FOLDER_COMPROBANTES, Number(user.userId) || 0, ID_MODULO_ARRENDATARIOS)).url;
    }

    const id = await this.ds.transaction((tx) =>
      this.cobranza.registrarPago(
        tx,
        {
          idArrendatario: dto.idArrendatario,
          fechaPago: new Date(dto.fechaPago),
          monto: dto.monto,
          idMetodoPago: dto.idMetodoPago ?? null,
          formaPagoSat,
          referencia: dto.referencia ?? null,
          comprobanteUrl,
          origen: "CAPTURA",
          idUsuario: user.userId ?? null,
        },
        aplicaciones,
      ),
    );
    await this.log("Pagos", `Se registró el pago ${id}`, "CREATE", { id, ...dto }, user);
    return { status: "success", message: "Pago registrado correctamente.", data: await this.obtenerPago(id) };
  }

  async listarPagos(q: ListarPagosQuery, user: UsuarioReq): Promise<ApiResponseCommon> {
    const where: string[] = [];
    const params: unknown[] = [];
    this.alcance(user, where, params, "p");
    if (q.idArrendatario) (where.push("p.IdArrendatario = ?"), params.push(q.idArrendatario));
    if (q.estatus !== undefined) (where.push("p.Estatus = ?"), params.push(q.estatus));
    if (q.fechaInicio) (where.push("p.FechaPago >= ?"), params.push(`${q.fechaInicio.slice(0, 10)} 00:00:00`));
    if (q.fechaFin) (where.push("p.FechaPago <= ?"), params.push(`${q.fechaFin.slice(0, 10)} 23:59:59`));
    if (q.conDisponible) where.push("p.Estatus = 1 AND p.Disponible > 0");

    const from = `FROM Pagos p
      JOIN Arrendatarios t ON t.Id = p.IdArrendatario
      JOIN Arrendadores a ON a.Id = t.IdArrendador
      LEFT JOIN CatMetodosPago mp ON mp.Id = p.IdMetodoPago
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
    const [{ total }] = await this.m.query(`SELECT COUNT(*) AS total ${from}`, params);
    const rows = await this.m.query(
      `SELECT ${PAGO_COLS} ${from} ORDER BY p.FechaPago DESC, p.Id DESC LIMIT ? OFFSET ?`,
      [...params, q.limit, (q.page - 1) * q.limit],
    );
    return {
      data: rows.map(mapPago),
      paginated: { total: Number(total), page: q.page, lastPage: Math.ceil(Number(total) / q.limit) },
    };
  }

  async obtenerPago(id: number) {
    const [row] = await this.m.query(
      `SELECT ${PAGO_COLS} FROM Pagos p
         JOIN Arrendatarios t ON t.Id = p.IdArrendatario
         LEFT JOIN CatMetodosPago mp ON mp.Id = p.IdMetodoPago
        WHERE p.Id = ?`,
      [id],
    );
    if (!row) throw new NotFoundException(`Pago ${id} no encontrado.`);
    const aplicaciones = await this.m.query(
      `SELECT pa.Id AS id, pa.Monto AS monto, pa.Estatus AS estatus, pa.FHRegistro AS fhRegistro, pa.FHAnulacion AS fhAnulacion,
              cc.Id AS idCargoConcepto, cc.Tipo AS tipo, cc.Descripcion AS descripcionConcepto,
              c.Id AS idCargo, c.Clase AS clase, c.Mes AS mes, c.Descripcion AS descripcionCargo
         FROM PagoAplicaciones pa
         JOIN CargoConceptos cc ON cc.Id = pa.IdCargoConcepto
         JOIN Cargos c ON c.Id = cc.IdCargo
        WHERE pa.IdPago = ?
        ORDER BY pa.Id`,
      [id],
    );
    return {
      ...mapPago(row),
      motivoCancelacion: row.motivoCancelacion,
      fhCancelacion: row.fhCancelacion,
      aplicaciones: aplicaciones.map((a: any) => ({
        id: Number(a.id),
        monto: money(cents(a.monto)),
        vigente: Number(a.estatus) === 1,
        fhRegistro: a.fhRegistro,
        fhAnulacion: a.fhAnulacion,
        concepto: { id: Number(a.idCargoConcepto), tipo: a.tipo, descripcion: a.descripcionConcepto },
        cargo: { id: Number(a.idCargo), clase: a.clase, mes: a.mes, descripcion: a.descripcionCargo },
      })),
    };
  }

  async aplicarPago(idPago: number, aplicaciones: AplicacionDto[], user: UsuarioReq) {
    await this.ds.transaction((tx) => this.cobranza.aplicar(tx, idPago, aplicaciones, user.userId ?? null));
    await this.log("Pagos", `Se aplicó el pago ${idPago}`, "UPDATE", { idPago, aplicaciones }, user);
    return { status: "success", message: "Pago aplicado correctamente.", data: await this.obtenerPago(idPago) };
  }

  async anularAplicacion(idPago: number, idAplicacion: number, user: UsuarioReq) {
    await this.ds.transaction(async (tx) => {
      const [ap] = await tx.query(`SELECT IdPago FROM PagoAplicaciones WHERE Id = ?`, [idAplicacion]);
      if (!ap || Number(ap.IdPago) !== idPago) {
        throw new NotFoundException(`Aplicación ${idAplicacion} no encontrada en el pago ${idPago}.`);
      }
      await this.cobranza.anularAplicacion(tx, idAplicacion, user.userId ?? null);
    });
    await this.log("Pagos", `Se anuló la aplicación ${idAplicacion} del pago ${idPago}`, "UPDATE", { idPago, idAplicacion }, user);
    return { status: "success", message: "Aplicación anulada; el monto quedó como saldo a favor.", data: await this.obtenerPago(idPago) };
  }

  async cancelarPago(id: number, motivo: string, user: UsuarioReq) {
    await this.ds.transaction((tx) => this.cobranza.cancelarPago(tx, id, motivo, user.userId ?? null));
    await this.log("Pagos", `Se canceló el pago ${id}: ${motivo}`, "UPDATE", { id, motivo }, user);
    return { status: "success", message: "Pago cancelado; los saldos se recalcularon.", data: await this.obtenerPago(id) };
  }

  // ─── Estado de cuenta ───────────────────────────────────────────────────────

  async estadoCuenta(idArrendatario: number, q: EstadoCuentaQuery) {
    const [arr] = await this.m.query(
      `SELECT t.Id AS id, t.Arrendatario AS nombre, t.Rfc AS rfc, t.Estatus AS estatus FROM Arrendatarios t WHERE t.Id = ?`,
      [idArrendatario],
    );
    if (!arr) throw new NotFoundException(`Arrendatario ${idArrendatario} no encontrado.`);

    const mesActual = getMesActual();
    const claveActual = mesActual.getFullYear() * 12 + mesActual.getMonth() + 1;
    const [resumen] = await this.m.query(
      `SELECT
         COALESCE(SUM(CASE WHEN c.Estatus = 1 THEN c.Saldo END), 0) AS saldoTotal,
         COALESCE(SUM(CASE WHEN c.Estatus = 1 AND (YEAR(c.Mes) * 12 + MONTH(c.Mes)) < ? THEN c.Saldo END), 0) AS saldoVencido,
         COALESCE(SUM(CASE WHEN c.Estatus = 1 AND c.Saldo > 0 THEN 1 END), 0) AS cargosConSaldo
       FROM Cargos c WHERE c.IdArrendatario = ?`,
      [claveActual, idArrendatario],
    );
    const [favor] = await this.m.query(
      `SELECT COALESCE(SUM(Disponible), 0) AS saldoAFavor FROM Pagos WHERE IdArrendatario = ? AND Estatus = 1`,
      [idArrendatario],
    );

    // Cargos: todos los que tienen saldo (cualquier fecha) más los del rango pedido.
    const rango = q.fechaInicio && q.fechaFin;
    const cargoWhere = rango
      ? `c.IdArrendatario = ? AND ((c.Estatus = 1 AND c.Saldo > 0) OR (c.Mes BETWEEN ? AND ?))`
      : `c.IdArrendatario = ? AND c.Estatus = 1 AND c.Saldo > 0`;
    const cargoParams = rango
      ? [idArrendatario, `${q.fechaInicio!.slice(0, 10)} 00:00:00`, `${q.fechaFin!.slice(0, 10)} 23:59:59`]
      : [idArrendatario];
    const cargos = await this.m.query(
      `SELECT ${CARGO_COLS} FROM Cargos c
         JOIN Arrendatarios t ON t.Id = c.IdArrendatario
         LEFT JOIN ContratoArrendatarios ct ON ct.Id = c.IdContrato
         LEFT JOIN Inmuebles i ON i.Id = ct.IdInmueble
        WHERE ${cargoWhere}
        ORDER BY c.Mes ASC, c.Id ASC`,
      cargoParams,
    );
    const conceptos = await this.conceptosDe(cargos.map((r: any) => Number(r.id)));

    const pagoWhere = rango ? `p.IdArrendatario = ? AND p.FechaPago BETWEEN ? AND ?` : `p.IdArrendatario = ?`;
    const pagos = await this.m.query(
      `SELECT ${PAGO_COLS} FROM Pagos p
         JOIN Arrendatarios t ON t.Id = p.IdArrendatario
         LEFT JOIN CatMetodosPago mp ON mp.Id = p.IdMetodoPago
        WHERE ${pagoWhere} OR (p.IdArrendatario = ? AND p.Estatus = 1 AND p.Disponible > 0)
        ORDER BY p.FechaPago DESC, p.Id DESC
        LIMIT 200`,
      [...cargoParams, idArrendatario],
    );

    return {
      arrendatario: { id: Number(arr.id), nombre: arr.nombre, rfc: arr.rfc, activo: Number(arr.estatus) === 1 },
      resumen: {
        saldoTotal: money(cents(resumen.saldoTotal)),
        saldoVencido: money(cents(resumen.saldoVencido)),
        saldoDelPeriodoActual: money(cents(resumen.saldoTotal) - cents(resumen.saldoVencido)),
        cargosConSaldo: Number(resumen.cargosConSaldo),
        saldoAFavor: money(cents(favor.saldoAFavor)),
      },
      cargos: cargos.map((r: any) => mapCargo(r, conceptos.get(Number(r.id)) ?? [])),
      pagos: pagos.map(mapPago),
    };
  }

  // ─── Utilidades ─────────────────────────────────────────────────────────────

  /** Alcance por cliente (rol > 1): arrendatarios de arrendadores del cliente del JWT. */
  private alcance(user: UsuarioReq, where: string[], params: unknown[], alias = "c") {
    if (isSuperAdmin(Number(user.rol))) return;
    where.push("a.IdCliente = ?");
    params.push(Number(user.cliente) || 0);
    void alias;
  }

  private async conceptosDe(idsCargo: number[]): Promise<Map<number, any[]>> {
    const result = new Map<number, any[]>();
    if (idsCargo.length === 0) return result;
    const rows = await this.m.query(
      `SELECT cc.Id AS id, cc.IdCargo AS idCargo, cc.Tipo AS tipo, cc.Descripcion AS descripcion,
              cc.IdTipoServicio AS idTipoServicio, cs.Nombre AS tipoServicio, cc.IdServicioArrendatario AS idServicioArrendatario,
              cc.Total AS total, cc.Subtotal AS subtotal, cc.Iva AS iva, cc.TasaIva AS tasaIva,
              cc.DesgloseEstimado AS desgloseEstimado, cc.Pagado AS pagado, cc.Saldo AS saldo
         FROM CargoConceptos cc
         LEFT JOIN CatServicios cs ON cs.Id = cc.IdTipoServicio
        WHERE cc.IdCargo IN (?) AND cc.Estatus = 1
        ORDER BY cc.Id`,
      [idsCargo],
    );
    for (const r of rows) {
      const list = result.get(Number(r.idCargo)) ?? [];
      list.push({
        id: Number(r.id),
        tipo: r.tipo,
        descripcion: r.descripcion,
        idTipoServicio: r.idTipoServicio != null ? Number(r.idTipoServicio) : null,
        tipoServicio: r.tipoServicio,
        idServicioArrendatario: r.idServicioArrendatario != null ? Number(r.idServicioArrendatario) : null,
        total: money(cents(r.total)),
        subtotal: money(cents(r.subtotal)),
        iva: money(cents(r.iva)),
        tasaIva: Number(r.tasaIva),
        desgloseEstimado: Number(r.desgloseEstimado) === 1,
        pagado: money(cents(r.pagado)),
        saldo: money(cents(r.saldo)),
      });
      result.set(Number(r.idCargo), list);
    }
    return result;
  }

  private async log(modulo: string, descripcion: string, accion: string, query: object, user: UsuarioReq) {
    if (!this.bitacora) return;
    try {
      await this.bitacora.logToBitacora(
        modulo,
        descripcion,
        accion,
        query,
        Number(user.userId) || 0,
        ID_MODULO_ARRENDATARIOS,
        EstatusEnumBitcora.SUCCESS,
      );
    } catch (err) {
      this.logger.warn(`No se pudo registrar en bitácora: ${(err as Error).message}`);
    }
  }
}

const CARGO_COLS = `c.Id AS id, c.Clase AS clase, c.IdArrendatario AS idArrendatario, t.Arrendatario AS arrendatario,
  c.IdContrato AS idContrato, i.Id AS idInmueble, i.Inmueble AS inmueble, c.Mes AS mes, c.FechaFin AS fechaFin,
  c.Descripcion AS descripcion, c.Total AS total, c.Pagado AS pagado, c.Saldo AS saldo, c.Liquidado AS liquidado,
  c.Estatus AS estatus, c.Origen AS origen, c.FHRegistro AS fhRegistro`;

const PAGO_COLS = `p.Id AS id, p.IdArrendatario AS idArrendatario, t.Arrendatario AS arrendatario, p.FechaPago AS fechaPago,
  p.Monto AS monto, p.Aplicado AS aplicado, p.Disponible AS disponible, p.IdMetodoPago AS idMetodoPago,
  mp.Nombre AS metodoPago, p.FormaPagoSat AS formaPagoSat, p.Referencia AS referencia, p.Concepto AS concepto,
  p.ComprobanteUrl AS comprobanteUrl, p.Origen AS origen, p.Estatus AS estatus, p.MotivoCancelacion AS motivoCancelacion,
  p.FHCancelacion AS fhCancelacion, p.FHRegistro AS fhRegistro`;

function mapCargo(r: any, conceptos: any[]) {
  return {
    id: Number(r.id),
    clase: r.clase,
    idArrendatario: Number(r.idArrendatario),
    arrendatario: r.arrendatario,
    idContrato: r.idContrato != null ? Number(r.idContrato) : null,
    idInmueble: r.idInmueble != null ? Number(r.idInmueble) : null,
    inmueble: r.inmueble,
    mes: r.mes,
    fechaFin: r.fechaFin,
    descripcion: r.descripcion,
    total: money(cents(r.total)),
    pagado: money(cents(r.pagado)),
    saldo: money(cents(r.saldo)),
    estadoPago: estadoPagoCargo({ liquidado: Number(r.liquidado), pagado: r.pagado, estatus: Number(r.estatus) }),
    origen: r.origen,
    fhRegistro: r.fhRegistro,
    conceptos,
  };
}

function mapPago(r: any) {
  return {
    id: Number(r.id),
    idArrendatario: Number(r.idArrendatario),
    arrendatario: r.arrendatario,
    fechaPago: r.fechaPago,
    monto: money(cents(r.monto)),
    aplicado: money(cents(r.aplicado)),
    disponible: money(cents(r.disponible)),
    idMetodoPago: r.idMetodoPago != null ? Number(r.idMetodoPago) : null,
    metodoPago: r.metodoPago,
    formaPagoSat: r.formaPagoSat,
    referencia: r.referencia,
    concepto: r.concepto,
    comprobanteUrl: r.comprobanteUrl,
    origen: r.origen,
    estatus: ESTATUS_PAGO_TEXTO[Number(r.estatus)],
    fhRegistro: r.fhRegistro,
  };
}
