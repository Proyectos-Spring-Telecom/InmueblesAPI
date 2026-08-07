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
import { CatServicios } from "./CatServicios";
import { ContratoArrendatarios } from "./ContratoArrendatarios";

@Index("FK_Servicio_Arrendatario_idx", ["idArrendatario"], {})
@Index("FK_Servicio_CatServicio_idx", ["idTipoServicio"], {})
@Index("FK_ServicioArrendatario_Contrato_idx", ["idContrato"], {})
@Entity("ServiciosArrendatarios")
@applySchema
export class ServiciosArrendatarios {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdArrendatario" })
  idArrendatario: number;

  @Column("bigint", { name: "IdTipoServicio" })
  idTipoServicio: number;

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

  @Column("bigint", { name: "IdContrato", nullable: true })
  idContrato: number | null;

  @ManyToOne(() => Arrendatarios, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdArrendatario", referencedColumnName: "id" }])
  arrendatario: Arrendatarios;

  @ManyToOne(() => CatServicios, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdTipoServicio", referencedColumnName: "id" }])
  tipoServicio: CatServicios;

  @ManyToOne(() => ContratoArrendatarios, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdContrato", referencedColumnName: "id" }])
  contrato: ContratoArrendatarios;
}
