import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { applySchema } from "src/utils/schema";
import { Usuarios } from "./Usuarios";

@Index("FK_ContratosGenerados_Usuarios", ["idUsuario"], {})
@Entity("ContratosGenerados")
@applySchema
export class ContratosGenerados {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdUsuario" })
  idUsuario: number;

  @Column("varchar", { name: "Clave", length: 120 })
  clave: string;

  @Column("varchar", { name: "Nombre", length: 250 })
  nombre: string;

  @Column("longtext", { name: "Contenido" })
  contenido: string;

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

  @ManyToOne(() => Usuarios, (usuario) => usuario.contratosGenerados, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdUsuario", referencedColumnName: "id" }])
  usuario: Usuarios;
}
