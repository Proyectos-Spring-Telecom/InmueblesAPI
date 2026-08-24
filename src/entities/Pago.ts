import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { applySchema } from "src/utils/schema";
import { CatMetodosPago } from "./CatMetodosPago";
import { Inmuebles } from "./Inmuebles";
import { ServiciosInmuebles } from "./ServiciosInmuebles";

@Index("FK_Inmueble_Pago_idx", ["idInmueble"], {})
@Index("¨FK_Servicio_Inmueble_idx", ["idServicioInmueble"], {})
@Index("FK_;Metodo_Pago_idx", ["idMetodoPago"], {})
@Entity("Pago")
@applySchema
export class Pago {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdInmueble", nullable: true })
  idInmueble: number | null;

  @Column("bigint", { name: "IdServicioInmueble", nullable: true })
  idServicioInmueble: number | null;

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

  @Column("datetime", { name: "FechaPagoFinal", nullable: true })
  fechaPagoFinal: Date | null;

  @Column("tinyint", { name: "EsPagoPeriodo", nullable: true })
  esPagoPeriodo: number | null;

  @ManyToOne(() => Inmuebles, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdInmueble", referencedColumnName: "id" }])
  inmueble: Inmuebles;

  @ManyToOne(() => ServiciosInmuebles, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdServicioInmueble", referencedColumnName: "id" }])
  servicioInmueble: ServiciosInmuebles;

  @ManyToOne(() => CatMetodosPago, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdMetodoPago", referencedColumnName: "id" }])
  metodoPago: CatMetodosPago;
}
