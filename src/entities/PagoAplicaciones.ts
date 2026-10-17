import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { applySchema } from "src/utils/schema";
import { CargoConceptos } from "./CargoConceptos";
import { Pagos } from "./Pagos";

/** Parte de un pago aplicada a un concepto de cargo. Se anula, nunca se edita ni borra. */
@Index("IX_PagoAplicaciones_Pago", ["idPago"], {})
@Index("IX_PagoAplicaciones_Concepto", ["idCargoConcepto"], {})
@Entity("PagoAplicaciones")
@applySchema
export class PagoAplicaciones {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdPago" })
  idPago: number;

  @Column("bigint", { name: "IdCargoConcepto" })
  idCargoConcepto: number;

  @Column("decimal", { name: "Monto", precision: 12, scale: 2 })
  monto: string;

  /** 1 vigente, 0 anulada */
  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @Column("datetime", { name: "FHRegistro", default: () => "CURRENT_TIMESTAMP" })
  fhRegistro: Date;

  @Column("bigint", { name: "IdUsuarioRegistro", nullable: true })
  idUsuarioRegistro: number | null;

  @Column("datetime", { name: "FHAnulacion", nullable: true })
  fhAnulacion: Date | null;

  @Column("bigint", { name: "IdUsuarioAnulacion", nullable: true })
  idUsuarioAnulacion: number | null;

  @ManyToOne(() => Pagos, (p) => p.aplicaciones, { onDelete: "NO ACTION", onUpdate: "NO ACTION" })
  @JoinColumn([{ name: "IdPago", referencedColumnName: "id" }])
  pago: Pagos;

  @ManyToOne(() => CargoConceptos, (c) => c.aplicaciones, { onDelete: "NO ACTION", onUpdate: "NO ACTION" })
  @JoinColumn([{ name: "IdCargoConcepto", referencedColumnName: "id" }])
  cargoConcepto: CargoConceptos;
}
