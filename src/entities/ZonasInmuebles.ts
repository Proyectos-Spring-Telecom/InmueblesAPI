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
import { Inmuebles } from "./Inmuebles";
import { LocalesZonaInmueble } from "./LocalesZonaInmueble";

@Index("FK_Zona_Inmueble_idx", ["idInmueble"], {})
@Entity("ZonasInmuebles")
@applySchema
export class ZonasInmuebles {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "ZonaPrincipal", nullable: true, length: 150 })
  zonaPrincipal: string | null;

  // DECIMAL(10,2): TypeORM lo expone como string para preservar precisión.
  @Column("decimal", {
    name: "SuperficieZonaM2",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  superficieZonaM2: string | null;

  @Column("decimal", {
    name: "SuperficieDisponibleM2",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  superficieDisponibleM2: string | null;

  @Column("int", { name: "NumeroZona", nullable: true })
  numeroZona: number | null;

  @Column("datetime", {
    name: "FHRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date | null;

  @Column("tinyint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;

  @Column("bigint", { name: "IdInmueble" })
  idInmueble: number;

  @ManyToOne(() => Inmuebles, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdInmueble", referencedColumnName: "id" }])
  inmueble: Inmuebles;

  @OneToMany(() => LocalesZonaInmueble, (local) => local.zona)
  locales: LocalesZonaInmueble[];
}
