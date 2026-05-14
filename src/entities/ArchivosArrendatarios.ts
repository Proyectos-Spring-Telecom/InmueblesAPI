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

@Index("FK_Archivos_Arrendatarios_idx", ["idArrendatario"], {})
@Entity("ArchivosArrendatarios")
@applySchema
export class ArchivosArrendatarios {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "Url", nullable: true, length: 500 })
  url: string | null;

  @Column("varchar", { name: "Nombre", nullable: true, length: 250 })
  nombre: string | null;

  @Column("datetime", {
    name: "FHRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date | null;

  @Column("tinyint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;

  @Column("bigint", { name: "IdArrendatario", nullable: true })
  idArrendatario: number | null;

  @ManyToOne(() => Arrendatarios, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdArrendatario", referencedColumnName: "id" }])
  arrendatario: Arrendatarios;
}
