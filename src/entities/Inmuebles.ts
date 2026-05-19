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
import { Clientes } from "./Clientes";
import { ServiciosInmuebles } from "./ServiciosInmuebles";
import { ZonasInmuebles } from "./ZonasInmuebles";
import { ArchivosInmuebles } from "./ArchivosInmuebles";

@Index("FK_Inmueble_Arrendador_idx", ["idArrendador"], {})
@Entity("Inmuebles")
@applySchema
export class Inmuebles {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "Inmueble", nullable: true, length: 400 })
  inmueble: string | null;

  @Column("bigint", { name: "IdArrendador" })
  idArrendador: number;

  @Column("text", { name: "DireccionFiscal", nullable: true })
  direccionFiscal: string | null;

  @Column("tinyint", { name: "EstatusInmueble", nullable: true })
  estatusInmueble: number | null;

  @Column("varchar", { name: "VigenciaAnios", nullable: true, length: 45 })
  vigenciaAnios: string | null;

  @Column("datetime", { name: "FechaInicio", nullable: true })
  fechaInicio: Date | null;

  @Column("datetime", { name: "FechaFin", nullable: true })
  fechaFin: Date | null;

  @Column("varchar", { name: "NombreRepresentante", nullable: true, length: 250 })
  nombreRepresentante: string | null;

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

  @Column("double", { name: "Lat", nullable: true })
  lat: number | null;

  @Column("double", { name: "Lng", nullable: true })
  lng: number | null;

  @Column("json", { name: "MapaInmueble", nullable: true })
  mapaInmueble: object | null;

  @ManyToOne(() => Clientes, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdArrendador", referencedColumnName: "id" }])
  arrendador: Clientes;

  @OneToMany(() => ServiciosInmuebles, (servicio) => servicio.inmueble)
  servicios: ServiciosInmuebles[];

  @OneToMany(() => ZonasInmuebles, (zona) => zona.inmueble)
  zonas: ZonasInmuebles[];

  @OneToMany(() => ArchivosInmuebles, (archivo) => archivo.inmueble)
  archivos: ArchivosInmuebles[];
}
