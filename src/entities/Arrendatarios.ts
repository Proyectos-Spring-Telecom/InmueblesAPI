import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { applySchema } from "src/utils/schema";
import { Clientes } from "./Clientes";

@Index("FK_Arrendatario_Arrendador_idx", ["idArrendador"], {})
@Entity("Arrendatarios")
@applySchema
export class Arrendatarios {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "Arrendatario", nullable: true, length: 250 })
  arrendatario: string | null;

  @Column("bigint", { name: "IdArrendador" })
  idArrendador: number;

  @Column("tinyint", { name: "TipoPersona", nullable: true })
  tipoPersona: number | null;

  // DECIMAL(10,2): TypeORM lo expone como string para preservar precisión.
  @Column("decimal", {
    name: "Renta",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  renta: string | null;

  @Column("datetime", { name: "FechaInicio", nullable: true })
  fechaInicio: Date | null;

  @Column("datetime", { name: "FechaFin", nullable: true })
  fechaFin: Date | null;

  @Column("varchar", { name: "TiempoRenta", nullable: true, length: 10 })
  tiempoRenta: string | null;

  @Column("varchar", { name: "RepresentanteLegal", nullable: true, length: 250 })
  representanteLegal: string | null;

  @Column("varchar", {
    name: "TelefonoRepresentante",
    nullable: true,
    length: 10,
  })
  telefonoRepresentante: string | null;

  @Column("varchar", {
    name: "CorreoRepresentante",
    nullable: true,
    length: 100,
  })
  correoRepresentante: string | null;

  @Column("datetime", {
    name: "FHRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date | null;

  @Column("tinyint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;

  @ManyToOne(() => Clientes, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdArrendador", referencedColumnName: "id" }])
  arrendador: Clientes;
}
