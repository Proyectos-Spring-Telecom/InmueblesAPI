import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { applySchema } from "src/utils/schema";
import { CatServicios } from "./CatServicios";
import { Inmuebles } from "./Inmuebles";

@Index("FK_ServicioInmueble_Servicio_idx", ["idTipoServicio"], {})
@Index("FK_ServicioInmueble_Inmueble_idx", ["idInmueble"], {})
@Entity("ServiciosInmuebles")
@applySchema
export class ServiciosInmuebles {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdTipoServicio", nullable: true })
  idTipoServicio: number | null;

  @Column("bigint", { name: "IdInmueble", nullable: true })
  idInmueble: number | null;

  @Column("varchar", { name: "NumeroContrato", nullable: true, length: 100 })
  numeroContrato: string | null;

  @Column("datetime", { name: "FechaPago", nullable: true })
  fechaPago: Date | null;

  @Column("datetime", { name: "UltimoDiaPago", nullable: true })
  ultimoDiaPago: Date | null;

  @Column("varchar", { name: "UrlComprobante", nullable: true, length: 500 })
  urlComprobante: string | null;

  @Column("datetime", {
    name: "FHRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date | null;

  @Column("tinyint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;

  @ManyToOne(() => CatServicios, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdTipoServicio", referencedColumnName: "id" }])
  tipoServicio: CatServicios;

  @ManyToOne(() => Inmuebles, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdInmueble", referencedColumnName: "id" }])
  inmueble: Inmuebles;
}
