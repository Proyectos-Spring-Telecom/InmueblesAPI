import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { applySchema } from "src/utils/schema";
import { ContratoArrendatarios } from "./ContratoArrendatarios";
import { LocalesZonaInmueble } from "./LocalesZonaInmueble";

@Index("FK_ContratoLocal_idx", ["idContrato"], {})
@Index("FK_ContratoLocal_Local_idx", ["idLocal"], {})
@Entity("ContratoLocales")
@applySchema
export class ContratoLocales {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdContrato", nullable: true })
  idContrato: number | null;

  @Column("bigint", { name: "IdLocal", nullable: true })
  idLocal: number | null;

  @Column("datetime", {
    name: "FHRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date | null;

  @Column("tinyint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;

  @Column("datetime", { name: "FechaBaja", nullable: true })
  fechaBaja: Date | null;

  @ManyToOne(() => ContratoArrendatarios, (contrato) => contrato.contratoLocales, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdContrato", referencedColumnName: "id" }])
  contrato: ContratoArrendatarios;

  @ManyToOne(() => LocalesZonaInmueble, (local) => local.contratoLocales, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdLocal", referencedColumnName: "id" }])
  local: LocalesZonaInmueble;
}
