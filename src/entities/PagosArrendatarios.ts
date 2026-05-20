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
import { CatMetodosPago } from "./CatMetodosPago";
import { ServiciosArrendatarios } from "./ServiciosArrendatarios";

@Index("FK_Arrendatario_PagoArrendatario_idx", ["idArrendatario"], {})
@Index("FK_Servicio_Arrendatario_Pago_idx", ["idServicioArrendatario"], {})
@Index("FK_Metodo_PagoArrendatario_idx", ["idMetodoPago"], {})
@Entity("PagosArrendatarios")
@applySchema
export class PagosArrendatarios {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdArrendatario", nullable: true })
  idArrendatario: number | null;

  @Column("bigint", { name: "IdServicioArrendatario", nullable: true })
  idServicioArrendatario: number | null;

  @Column("varchar", { name: "Concepto", nullable: true, length: 100 })
  concepto: string | null;

  @Column("datetime", { name: "FechaPago", nullable: true })
  fechaPago: Date | null;

  @Column("decimal", {
    name: "Monto",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  monto: string | null;

  @Column("bigint", { name: "IdMetodoPago", nullable: true })
  idMetodoPago: number | null;

  /** Pendiente = 2, Pagado = 1, Cancelado = 0 */
  @Column("tinyint", { name: "Estatus", nullable: true })
  estatus: number | null;

  @Column("datetime", {
    name: "FHRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date | null;

  @Column("varchar", {
    name: "ComprobantePago",
    nullable: true,
    length: 500,
  })
  comprobantePago: string | null;

  @ManyToOne(() => Arrendatarios, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdArrendatario", referencedColumnName: "id" }])
  arrendatario: Arrendatarios;

  @ManyToOne(() => ServiciosArrendatarios, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([
    { name: "IdServicioArrendatario", referencedColumnName: "id" },
  ])
  servicioArrendatario: ServiciosArrendatarios;

  @ManyToOne(() => CatMetodosPago, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdMetodoPago", referencedColumnName: "id" }])
  metodoPago: CatMetodosPago;
}
