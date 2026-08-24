import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { applySchema } from "src/utils/schema";
import { Arrendatarios } from "./Arrendatarios";
import { ContratoArrendatarios } from "./ContratoArrendatarios";
import { Formulas } from "./Formulas";

@Index("FK_Renta_Arrendatario_idx", ["idArrendatario"], {})
@Index("FK_Renta_Contrato_idx", ["idContrato"], {})
@Entity("RentaActual")
@applySchema
export class RentaActual {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdArrendatario", nullable: true })
  idArrendatario: number | null;

  @Column("datetime", { name: "Mes", nullable: true })
  mes: Date | null;

  @Column("decimal", {
    name: "Total",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  total: string | null;

  @Column("bigint", { name: "IdFormula", nullable: true })
  idFormula: number | null;

  @Column("datetime", {
    name: "FHRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date | null;

  @Column("decimal", {
    name: "MontoFinal",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  montoFinal: string | null;

  @Column("decimal", {
    name: "TotalMantenimiento",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  totalMantenimiento: string | null;

  @Column("decimal", {
    name: "MontoFinalMantenimiento",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  montoFinalMantenimiento: string | null;

  @Column("datetime", { name: "FechaFin", nullable: true })
  fechaFin: Date | null;

  @Column("tinyint", { name: "UsaFormula", nullable: true })
  usaFormula: number | null;

  @Column("tinyint", { name: "EsPeriodo", nullable: true })
  esPeriodo: number | null;

  @Column("decimal", {
    name: "FactorVariable",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  factorVariable: string | null;

  @Column("tinyint", { name: "OcupoFormula", nullable: true })
  ocupoFormula: number | null;

  @Column("bigint", { name: "IdContrato", nullable: true })
  idContrato: number | null;

  @Column("tinyint", { name: "Pagada", nullable: true, default: () => "'0'" })
  pagada: number | null;

  @ManyToOne(() => Arrendatarios, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdArrendatario", referencedColumnName: "id" }])
  arrendatario: Arrendatarios;

  @ManyToOne(() => ContratoArrendatarios, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdContrato", referencedColumnName: "id" }])
  contrato: ContratoArrendatarios;

  @ManyToOne(() => Formulas, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdFormula", referencedColumnName: "id" }])
  formula: Formulas;
}
