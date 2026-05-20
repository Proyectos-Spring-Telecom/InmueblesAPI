import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { applySchema } from "src/utils/schema";
import { Inmuebles } from "./Inmuebles";

@Index("FK_EntradasSalidas_Inmueble_idx", ["idInmueble"], {})
@Entity("EntradasSalidasEstacionamiento")
@applySchema
export class EntradasSalidasEstacionamiento {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "Boleto", nullable: true, length: 45 })
  boleto: string | null;

  @Column("datetime", { name: "FechaEntrada", nullable: true })
  fechaEntrada: Date | null;

  @Column("datetime", { name: "FechaSalida", nullable: true })
  fechaSalida: Date | null;

  @Column("decimal", {
    name: "Total",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  total: string | null;

  @Column("bigint", { name: "IdInmueble", nullable: true })
  idInmueble: number | null;

  @Column("datetime", {
    name: "FHRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date | null;

  @ManyToOne(() => Inmuebles, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdInmueble", referencedColumnName: "id" }])
  inmueble: Inmuebles;
}
