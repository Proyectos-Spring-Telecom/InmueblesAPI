import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { applySchema } from "src/utils/schema";

@Entity("Factores")
@applySchema
export class Factores {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "Variable", nullable: true, length: 500 })
  variable: string | null;

  @Column("varchar", { name: "Valor", nullable: true, length: 500 })
  valor: string | null;

  @Column("varchar", { name: "Descripcion", nullable: true, length: 500 })
  descripcion: string | null;

  @Column("tinyint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;

  @Column("tinyint", { name: "EsContrato", nullable: true })
  esContrato: number | null;

  @Column("int", { name: "AnioINPC", nullable: true })
  anioInpc: number | null;

  @Column("int", { name: "MesINPC", nullable: true })
  mesInpc: number | null;

  @Column("datetime", {
    name: "FHRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date | null;
}
