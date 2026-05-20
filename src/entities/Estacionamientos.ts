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
import { Inmuebles } from "./Inmuebles";

@Index("FK_Estacionamiento_Inmueble_idx", ["idInmueble"], {})
@Index("FK_Estacionamiento_Arrendatario_idx", ["idArrendatario"], {})
@Entity("Estacionamientos")
@applySchema
export class Estacionamientos {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdInmueble", nullable: true })
  idInmueble: number | null;

  @Column("varchar", { name: "NombrePensionado", nullable: true, length: 200 })
  nombrePensionado: string | null;

  @Column("varchar", { name: "NumeroTarjeta", nullable: true, length: 50 })
  numeroTarjeta: string | null;

  @Column("bigint", { name: "IdArrendatario", nullable: true })
  idArrendatario: number | null;

  @Column("datetime", {
    name: "FHRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date | null;

  @Column("tinyint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;

  @ManyToOne(() => Inmuebles, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdInmueble", referencedColumnName: "id" }])
  inmueble: Inmuebles;

  @ManyToOne(() => Arrendatarios, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdArrendatario", referencedColumnName: "id" }])
  arrendatario: Arrendatarios;
}
