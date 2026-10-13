import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { applySchema } from "src/utils/schema";
import { EmbudoVentas } from "./EmbudoVentas";

@Index("FK_EventosEmbudoVentas_Embudo", ["idEmbudoVentas"], {})
@Entity("EventosEmbudoVentas")
@applySchema
export class EventosEmbudoVentas {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdEmbudoVentas" })
  idEmbudoVentas: number;

  @Column("datetime", { name: "FHProximoEvento" })
  fhProximoEvento: Date;

  /** 1 Llamada, 2 Correo, 3 Visita */
  @Column("tinyint", { name: "MedioComunicacion" })
  medioComunicacion: number;

  /** 0 pendiente, 1 realizada */
  @Column("tinyint", { name: "Estatus", default: () => "'0'" })
  estatus: number;

  @Column("text", { name: "Comentario", nullable: true })
  comentario: string | null;

  @Column("text", { name: "ConclusionEvento", nullable: true })
  conclusionEvento: string | null;

  @ManyToOne(() => EmbudoVentas, (embudo) => embudo.eventos, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdEmbudoVentas", referencedColumnName: "id" }])
  embudoVentas: EmbudoVentas;
}
