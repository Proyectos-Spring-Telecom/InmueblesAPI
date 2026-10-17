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
import { Cargos } from "./Cargos";
import { CatServicios } from "./CatServicios";
import { PagoAplicaciones } from "./PagoAplicaciones";
import { ServiciosArrendatarios } from "./ServiciosArrendatarios";

export type TipoConceptoCargo = "RENTA" | "MANTENIMIENTO" | "SERVICIO";

/**
 * Línea de un cargo (renta, mantenimiento o servicio). Es la unidad a la que se aplican
 * pagos y que ampara una factura. `total` = montoFinal ?? montoBase.
 */
@Index("IX_CargoConceptos_Cargo", ["idCargo"], {})
@Entity("CargoConceptos")
@applySchema
export class CargoConceptos {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdCargo" })
  idCargo: number;

  @Column("varchar", { name: "Tipo", length: 15 })
  tipo: TipoConceptoCargo;

  @Column("bigint", { name: "IdTipoServicio", nullable: true })
  idTipoServicio: number | null;

  @Column("bigint", { name: "IdServicioArrendatario", nullable: true })
  idServicioArrendatario: number | null;

  @Column("varchar", { name: "Descripcion", nullable: true, length: 200 })
  descripcion: string | null;

  /** Monto antes de fórmula (equivale a `total` / `totalMantenimiento` de RentaActual). */
  @Column("decimal", { name: "MontoBase", nullable: true, precision: 12, scale: 2 })
  montoBase: string | null;

  /** Monto ajustado (equivale a `montoFinal` / `montoFinalMantenimiento`). */
  @Column("decimal", { name: "MontoFinal", nullable: true, precision: 12, scale: 2 })
  montoFinal: string | null;

  /** Monto a cobrar, IVA incluido. */
  @Column("decimal", { name: "Total", precision: 12, scale: 2 })
  total: string;

  @Column("decimal", { name: "TasaIva", precision: 5, scale: 4, default: () => "'0.1600'" })
  tasaIva: string;

  @Column("decimal", { name: "Subtotal", precision: 12, scale: 2 })
  subtotal: string;

  @Column("decimal", { name: "Iva", precision: 12, scale: 2 })
  iva: string;

  /** 1 si subtotal/IVA se calcularon a partir del total (no capturados). */
  @Column("tinyint", { name: "DesgloseEstimado", default: () => "'0'" })
  desgloseEstimado: number;

  @Column("decimal", { name: "Pagado", precision: 12, scale: 2, default: () => "'0.00'" })
  pagado: string;

  @Column("decimal", { name: "Saldo", precision: 12, scale: 2, default: () => "'0.00'" })
  saldo: string;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @Column("datetime", { name: "FHRegistro", default: () => "CURRENT_TIMESTAMP" })
  fhRegistro: Date;

  @ManyToOne(() => Cargos, (c) => c.conceptos, { onDelete: "NO ACTION", onUpdate: "NO ACTION" })
  @JoinColumn([{ name: "IdCargo", referencedColumnName: "id" }])
  cargo: Cargos;

  @ManyToOne(() => CatServicios, { onDelete: "NO ACTION", onUpdate: "NO ACTION" })
  @JoinColumn([{ name: "IdTipoServicio", referencedColumnName: "id" }])
  tipoServicio: CatServicios;

  @ManyToOne(() => ServiciosArrendatarios, { onDelete: "NO ACTION", onUpdate: "NO ACTION" })
  @JoinColumn([{ name: "IdServicioArrendatario", referencedColumnName: "id" }])
  servicioArrendatario: ServiciosArrendatarios;

  @OneToMany(() => PagoAplicaciones, (a) => a.cargoConcepto)
  aplicaciones: PagoAplicaciones[];
}
