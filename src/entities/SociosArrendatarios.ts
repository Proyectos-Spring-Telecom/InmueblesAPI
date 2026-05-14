import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { applySchema } from "src/utils/schema";
import { Arrendatarios } from "./Arrendatarios";

@Entity("SociosArrendatarios")
@applySchema
export class SociosArrendatarios {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdArrendatario" })
  idArrendatario: number;

  @Column("varchar", { name: "Nombre", nullable: true, length: 500 })
  nombre: string | null;

  @Column("varchar", { name: "RFC", nullable: true, length: 25 })
  rfc: string | null;

  @Column("varchar", {
    name: "ConstanciaSituacionFiscal",
    nullable: true,
    length: 500,
  })
  constanciaSituacionFiscal: string | null;

  @Column("varchar", {
    name: "ComprobanteDomicilio",
    nullable: true,
    length: 500,
  })
  comprobanteDomicilio: string | null;

  @Column("varchar", {
    name: "IdentificacionOficial",
    nullable: true,
    length: 500,
  })
  identificacionOficial: string | null;

  @Column("datetime", {
    name: "FHRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date | null;

  @Column("tinyint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;

  @ManyToOne(() => Arrendatarios, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdArrendatario", referencedColumnName: "id" }])
  arrendatario: Arrendatarios;
}
