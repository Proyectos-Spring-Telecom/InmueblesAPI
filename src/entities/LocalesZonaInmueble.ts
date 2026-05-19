import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { applySchema } from "src/utils/schema";
import { ZonasInmuebles } from "./ZonasInmuebles";
import { ContratoArrendatarios } from "./ContratoArrendatarios";

@Index("FK_Zona_Locales_idx", ["idZona"], {})
@Entity("LocalesZonaInmueble")
@applySchema
export class LocalesZonaInmueble {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "Nombre", nullable: true, length: 250 })
  nombre: string | null;

  @Column("decimal", {
    name: "AreaM2",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  areaM2: string | null;

  @Column("tinyint", { name: "Estatus", nullable: true })
  estatus: number | null;

  @Column("decimal", {
    name: "Mensualidad",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  mensualidad: string | null;

  @Column("varchar", { name: "Giro", nullable: true, length: 100 })
  giro: string | null;

  @Column("bigint", { name: "IdZona", nullable: true })
  idZona: number | null;

  @Column("datetime", {
    name: "FHRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date | null;

  @ManyToOne(() => ZonasInmuebles, (zona) => zona.locales, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdZona", referencedColumnName: "id" }])
  zona: ZonasInmuebles;

  @OneToMany(() => ContratoArrendatarios, (contrato) => contrato.local)
  contratos: ContratoArrendatarios[];
}
