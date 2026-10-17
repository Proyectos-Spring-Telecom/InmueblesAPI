import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { applySchema } from "src/utils/schema";
import { Arrendatarios } from "./Arrendatarios";
import { CatMetodosPago } from "./CatMetodosPago";
import { PagoAplicaciones } from "./PagoAplicaciones";

/** Estatus de un pago recibido. Sólo los CONFIRMADO tienen aplicaciones vigentes. */
export enum PagoRecibidoEstatus {
  Cancelado = 0,
  Confirmado = 1,
  PorConfirmar = 2,
}

/**
 * Dinero recibido de un arrendatario (una exhibición). Se reparte en aplicaciones a
 * conceptos de cargos; lo no aplicado es saldo a favor.
 */
@Index("IX_Pagos_Arrendatario", ["idArrendatario"], {})
@Entity("Pagos")
@applySchema
export class Pagos {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdArrendatario" })
  idArrendatario: number;

  /** Fecha real en que se recibió el dinero (puede ser retroactiva). */
  @Column("datetime", { name: "FechaPago" })
  fechaPago: Date;

  /** Compatibilidad con pagos de servicio que cubren un periodo. */
  @Column("datetime", { name: "FechaPagoFinal", nullable: true })
  fechaPagoFinal: Date | null;

  @Column("decimal", { name: "Monto", precision: 12, scale: 2 })
  monto: string;

  @Column("decimal", { name: "Aplicado", precision: 12, scale: 2, default: () => "'0.00'" })
  aplicado: string;

  /** Saldo a favor de este pago: monto − aplicado (0 si no está confirmado). */
  @Column("decimal", { name: "Disponible", precision: 12, scale: 2, default: () => "'0.00'" })
  disponible: string;

  @Column("bigint", { name: "IdMetodoPago", nullable: true })
  idMetodoPago: number | null;

  /** c_FormaPago del SAT (01, 02, 03, 04, 28…). */
  @Column("char", { name: "FormaPagoSat", nullable: true, length: 2 })
  formaPagoSat: string | null;

  @Column("varchar", { name: "Referencia", nullable: true, length: 100 })
  referencia: string | null;

  @Column("varchar", { name: "Concepto", nullable: true, length: 100 })
  concepto: string | null;

  @Column("varchar", { name: "ComprobanteUrl", nullable: true, length: 500 })
  comprobanteUrl: string | null;

  /** Cargo para el que se registró (compatibilidad con pagos de servicio). */
  @Column("bigint", { name: "IdCargoReferencia", nullable: true })
  idCargoReferencia: number | null;

  /** CAPTURA, MIGRACION, LEGACY */
  @Column("varchar", { name: "Origen", length: 20 })
  origen: string;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: PagoRecibidoEstatus;

  @Column("varchar", { name: "MotivoCancelacion", nullable: true, length: 300 })
  motivoCancelacion: string | null;

  @Column("datetime", { name: "FHCancelacion", nullable: true })
  fhCancelacion: Date | null;

  @Column("bigint", { name: "IdUsuarioCancelacion", nullable: true })
  idUsuarioCancelacion: number | null;

  @Column("bigint", { name: "IdLegacyPagoArrendatario", nullable: true })
  idLegacyPagoArrendatario: number | null;

  @Column("datetime", { name: "FHRegistro", default: () => "CURRENT_TIMESTAMP" })
  fhRegistro: Date;

  @Column("bigint", { name: "IdUsuarioRegistro", nullable: true })
  idUsuarioRegistro: number | null;

  @ManyToOne(() => Arrendatarios, { onDelete: "NO ACTION", onUpdate: "NO ACTION" })
  @JoinColumn([{ name: "IdArrendatario", referencedColumnName: "id" }])
  arrendatario: Arrendatarios;

  @ManyToOne(() => CatMetodosPago, { onDelete: "NO ACTION", onUpdate: "NO ACTION" })
  @JoinColumn([{ name: "IdMetodoPago", referencedColumnName: "id" }])
  metodoPago: CatMetodosPago;

  @OneToMany(() => PagoAplicaciones, (a) => a.pago)
  aplicaciones: PagoAplicaciones[];
}
