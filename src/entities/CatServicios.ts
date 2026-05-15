import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { applySchema } from "src/utils/schema";

@Entity("CatServicios")
@applySchema
export class CatServicios {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "Nombre", length: 45, nullable: true })
  nombre: string | null;

  @Column("bigint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;

  @Column("varchar", { name: "FHRegistro", length: 45, nullable: true })
  fhRegistro: string | null;
}

