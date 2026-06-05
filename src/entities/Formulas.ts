import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { applySchema } from "src/utils/schema";

@Entity("Formulas")
@applySchema
export class Formulas {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "Nombre", nullable: true, length: 200 })
  nombre: string | null;

  @Column("text", { name: "Formula", nullable: true })
  formula: string | null;

  @Column("varchar", { name: "Descripcion", nullable: true, length: 500 })
  descripcion: string | null;

  @Column("enum", {
    name: "TipoResultado",
    enum: ["MONTO", "PORCENTAJE"],
    default: "MONTO",
  })
  tipoResultado: string;

  @Column("tinyint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;

  @Column("datetime", {
    name: "FHRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date | null;

  @Column("datetime", {
    name: "FHActualizacion",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhActualizacion: Date | null;
}
