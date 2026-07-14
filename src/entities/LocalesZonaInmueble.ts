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
import { ContratoLocales } from "./ContratoLocales";

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

  @Column("varchar", { name: "FachadaUrl", nullable: true, length: 500 })
  fachadaUrl: string | null;

  @Column("decimal", {
    name: "MensualidadIVA",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  mensualidadIva: string | null;

  @Column("decimal", {
    name: "Mantenimiento",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  mantenimiento: string | null;

  @Column("decimal", {
    name: "MantenimientoIVA",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  mantenimientoIva: string | null;

  @ManyToOne(() => ZonasInmuebles, (zona) => zona.locales, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdZona", referencedColumnName: "id" }])
  zona: ZonasInmuebles;

  @OneToMany(() => ContratoLocales, (cl) => cl.local)
  contratoLocales: ContratoLocales[];
}
