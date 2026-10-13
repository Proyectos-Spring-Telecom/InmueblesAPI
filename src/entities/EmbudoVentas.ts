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
import { Usuarios } from "./Usuarios";
import { Clientes } from "./Clientes";
import { EventosEmbudoVentas } from "./EventosEmbudoVentas";

@Index("FK_EmbudoVentas_Usuarios", ["idUsuario"], {})
@Index("FK_EmbudoVentas_Clientes", ["idCliente"], {})
@Entity("EmbudoVentas")
@applySchema
export class EmbudoVentas {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdUsuario" })
  idUsuario: number;

  @Column("bigint", { name: "IdCliente" })
  idCliente: number;

  @Column("datetime", {
    name: "FHRegistro",
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date;

  @Column("datetime", {
    name: "FHUpdate",
    default: () => "CURRENT_TIMESTAMP",
  })
  fhUpdate: Date;

  /** 1 = Registrado */
  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @ManyToOne(() => Usuarios, (usuario) => usuario.embudosVentas, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdUsuario", referencedColumnName: "id" }])
  usuario: Usuarios;

  @ManyToOne(() => Clientes, (cliente) => cliente.embudosVentas, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdCliente", referencedColumnName: "id" }])
  cliente: Clientes;

  @OneToMany(() => EventosEmbudoVentas, (evento) => evento.embudoVentas)
  eventos: EventosEmbudoVentas[];
}
