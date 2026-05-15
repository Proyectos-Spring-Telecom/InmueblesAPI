import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { applySchema } from "src/utils/schema";

@Entity("INPC")
@applySchema
export class Inpc {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("int", { name: "Anio", nullable: true })
  anio: number | null;

  @Column("int", { name: "Mes", nullable: true })
  mes: number | null;

  @Column("decimal", {
    name: "INPC",
    nullable: true,
    precision: 10,
    scale: 4,
  })
  inpc: string | null;

  @Column("datetime", {
    name: "FHRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date | null;

  @Column("tinyint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;
}
