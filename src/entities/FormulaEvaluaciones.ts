import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { applySchema } from "src/utils/schema";
import { Formulas } from "./Formulas";

@Entity("FormulaEvaluaciones")
@applySchema
export class FormulaEvaluaciones {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdFormula" })
  idFormula: number;

  @Column("bigint", { name: "IdContrato", nullable: true })
  idContrato: number | null;

  @Column("bigint", { name: "IdArrendatario", nullable: true })
  idArrendatario: number | null;

  @Column("json", { name: "VariablesUsadas" })
  variablesUsadas: string | null;

  @Column("varchar", { name: "ExpresionFinal", nullable: true, length: 500 })
  expresionFinal: string | null;

  @Column("decimal", {
    name: "Resultado",
    precision: 14,
    scale: 4,
  })
  resultado: string | null;

  @Column("datetime", { name: "MesAplicacion", nullable: true })
  mesAplicacion: Date | null;

  @Column("datetime", {
    name: "FHRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date | null;

  @ManyToOne(() => Formulas, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdFormula", referencedColumnName: "id" }])
  formula: Formulas;
}
