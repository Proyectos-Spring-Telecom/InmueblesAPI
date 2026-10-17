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
import { CargoConceptos } from "./CargoConceptos";
import { ContratoArrendatarios } from "./ContratoArrendatarios";
import { Formulas } from "./Formulas";

/** Clase de cargo: renta mensual (renta + mantenimiento), servicio (luz, agua…) u otro. */
export type ClaseCargo = "RENTA" | "SERVICIO" | "OTRO";

/**
 * Lo que debe un arrendatario por un mes o periodo. No cambia de tabla al pagarse:
 * su estado se calcula a partir de las aplicaciones de pagos a sus conceptos.
 * Total/Pagado/Saldo/Liquidado se recalculan en la misma transacción de cada cambio.
 */
@Index("IX_Cargos_Arrendatario", ["idArrendatario"], {})
@Index("IX_Cargos_Contrato_Mes", ["idContrato", "mes"], {})
@Entity("Cargos")
@applySchema
export class Cargos {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdArrendatario" })
  idArrendatario: number;

  @Column("bigint", { name: "IdContrato", nullable: true })
  idContrato: number | null;

  @Column("varchar", { name: "Clase", length: 15 })
  clase: ClaseCargo;

  /** Inicio del periodo que cubre (equivale a `mes` de RentaActual). */
  @Column("datetime", { name: "Mes" })
  mes: Date;

  /** Fin del periodo cuando cubre varios meses (equivale a `fechaFin`). */
  @Column("datetime", { name: "FechaFin", nullable: true })
  fechaFin: Date | null;

  @Column("varchar", { name: "Descripcion", nullable: true, length: 200 })
  descripcion: string | null;

  @Column("bigint", { name: "IdFormula", nullable: true })
  idFormula: number | null;

  @Column("tinyint", { name: "UsaFormula", nullable: true })
  usaFormula: number | null;

  @Column("tinyint", { name: "OcupoFormula", nullable: true })
  ocupoFormula: number | null;

  @Column("decimal", { name: "FactorVariable", nullable: true, precision: 10, scale: 2 })
  factorVariable: string | null;

  @Column("decimal", { name: "Total", precision: 12, scale: 2, default: () => "'0.00'" })
  total: string;

  @Column("decimal", { name: "Pagado", precision: 12, scale: 2, default: () => "'0.00'" })
  pagado: string;

  @Column("decimal", { name: "Saldo", precision: 12, scale: 2, default: () => "'0.00'" })
  saldo: string;

  /** 1 cuando el saldo es 0 (o un cargo sin monto fue marcado pagado). */
  @Column("tinyint", { name: "Liquidado", default: () => "'0'" })
  liquidado: number;

  /** Marca explícita de pagado para cargos con total 0 (compatibilidad con `pagada`). */
  @Column("tinyint", { name: "MarcaPagadoSinMonto", default: () => "'0'" })
  marcaPagadoSinMonto: number;

  /** RENTA_MENSUAL, SERVICIO, MANUAL, MIGRACION, HISTORICO */
  @Column("varchar", { name: "Origen", length: 20 })
  origen: string;

  /** 1 vigente, 0 cancelado */
  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @Column("bigint", { name: "IdLegacyRentaActual", nullable: true })
  idLegacyRentaActual: number | null;

  @Column("bigint", { name: "IdLegacyHistorico", nullable: true })
  idLegacyHistorico: number | null;

  @Column("bigint", { name: "IdLegacyPagoArrendatario", nullable: true })
  idLegacyPagoArrendatario: number | null;

  @Column("datetime", { name: "FHRegistro", default: () => "CURRENT_TIMESTAMP" })
  fhRegistro: Date;

  @Column("bigint", { name: "IdUsuarioRegistro", nullable: true })
  idUsuarioRegistro: number | null;

  @Column("datetime", { name: "FHActualizacion", nullable: true })
  fhActualizacion: Date | null;

  @ManyToOne(() => Arrendatarios, { onDelete: "NO ACTION", onUpdate: "NO ACTION" })
  @JoinColumn([{ name: "IdArrendatario", referencedColumnName: "id" }])
  arrendatario: Arrendatarios;

  @ManyToOne(() => ContratoArrendatarios, { onDelete: "NO ACTION", onUpdate: "NO ACTION" })
  @JoinColumn([{ name: "IdContrato", referencedColumnName: "id" }])
  contrato: ContratoArrendatarios;

  @ManyToOne(() => Formulas, { onDelete: "NO ACTION", onUpdate: "NO ACTION" })
  @JoinColumn([{ name: "IdFormula", referencedColumnName: "id" }])
  formula: Formulas;

  @OneToMany(() => CargoConceptos, (c) => c.cargo)
  conceptos: CargoConceptos[];
}
