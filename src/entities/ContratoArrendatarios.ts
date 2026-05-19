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
import { Inmuebles } from "./Inmuebles";
import { LocalesZonaInmueble } from "./LocalesZonaInmueble";

@Index("FK_Contrato_Arrendatario_idx", ["idArrendatario"], {})
@Index("FK_Contrato_Inmueble_idx", ["idInmueble"], {})
@Index("FK_Contrato_Locales_idx", ["idLocal"], {})
@Entity("ContratoArrendatarios")
@applySchema
export class ContratoArrendatarios {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdInmueble", nullable: true })
  idInmueble: number | null;

  @Column("datetime", { name: "FechaInicioContrato", nullable: true })
  fechaInicioContrato: Date | null;

  @Column("datetime", { name: "FechaTerminoContrato", nullable: true })
  fechaTerminoContrato: Date | null;

  @Column("varchar", { name: "Moneda", nullable: true, length: 10 })
  moneda: string | null;

  // DECIMAL(10,2): TypeORM lo expone como string para preservar precisión.
  @Column("decimal", {
    name: "MetrosRentados",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  metrosRentados: string | null;

  @Column("decimal", {
    name: "CostoM2",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  costoM2: string | null;

  @Column("decimal", {
    name: "PorcentajeMantenimiento",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  porcentajeMantenimiento: string | null;

  // MySQL `DECIMAL` sin precisión = DECIMAL(10,0)
  @Column("decimal", { name: "MesesDeposito", nullable: true })
  mesesDeposito: string | null;

  @Column("decimal", {
    name: "MontoDeposito",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  montoDeposito: string | null;

  @Column("decimal", { name: "MesesAdelanto", nullable: true })
  mesesAdelanto: string | null;

  @Column("decimal", {
    name: "MontoAdelanto",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  montoAdelanto: string | null;

  @Column("int", { name: "AniosForzososArrendador", nullable: true })
  aniosForzososArrendador: number | null;

  @Column("int", { name: "AniosForzososArrendatario", nullable: true })
  aniosForzososArrendatario: number | null;

  @Column("decimal", {
    name: "SubTotalRenta",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  subTotalRenta: string | null;

  @Column("decimal", {
    name: "IVARenta",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  ivaRenta: string | null;

  @Column("decimal", {
    name: "RentaTotal",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  rentaTotal: string | null;

  @Column("decimal", {
    name: "SubTotalMantenimiento",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  subTotalMantenimiento: string | null;

  @Column("decimal", {
    name: "IVAMantenimiento",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  ivaMantenimiento: string | null;

  @Column("decimal", {
    name: "MantenimientoTotal",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  mantenimientoTotal: string | null;

  @Column("text", { name: "Observaciones", nullable: true })
  observaciones: string | null;

  @Column("bigint", { name: "IdArrendatario", nullable: true })
  idArrendatario: number | null;

  @Column("datetime", {
    name: "FHRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date | null;

  @Column("tinyint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;

  @Column("bigint", { name: "IdLocal", nullable: true })
  idLocal: number | null;

  @ManyToOne(() => Arrendatarios, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdArrendatario", referencedColumnName: "id" }])
  arrendatario: Arrendatarios;

  @ManyToOne(() => Inmuebles, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdInmueble", referencedColumnName: "id" }])
  inmueble: Inmuebles;

  @ManyToOne(() => LocalesZonaInmueble, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdLocal", referencedColumnName: "id" }])
  local: LocalesZonaInmueble;
}
