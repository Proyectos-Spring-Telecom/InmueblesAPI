import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { applySchema } from "src/utils/schema";

@Entity("CatMetodosPago")
@applySchema
export class CatMetodosPago {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "Nombre", nullable: true, length: 100 })
  nombre: string | null;

  @Column("datetime", {
    name: "FHRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date | null;

  @Column("tinyint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;

  /** c_FormaPago del SAT que corresponde a este método (para facturación). */
  @Column("char", { name: "FormaPagoSat", nullable: true, length: 2 })
  formaPagoSat: string | null;
}
