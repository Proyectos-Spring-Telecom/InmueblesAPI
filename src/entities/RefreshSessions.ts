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

@Index("UQ_RefreshSessions_Jti", ["jti"], { unique: true })
@Index("FK_RefreshSessions_Usuarios", ["idUsuario"], {})
@Index("FK_RefreshSessions_ReplacedBy", ["replacedById"], {})
@Entity("RefreshSessions")
@applySchema
export class RefreshSessions {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdUsuario" })
  idUsuario: number;

  @Column("varchar", { name: "Jti", length: 36 })
  jti: string;

  @Column("char", { name: "TokenHash", length: 64 })
  tokenHash: string;

  @Column("datetime", { name: "ExpiresAt" })
  expiresAt: Date;

  @Column("datetime", { name: "RevokedAt", nullable: true })
  revokedAt: Date | null;

  @Column("datetime", {
    name: "FechaCreacion",
    default: () => "CURRENT_TIMESTAMP",
  })
  fechaCreacion: Date;

  @Column("bigint", { name: "ReplacedById", nullable: true })
  replacedById: number | null;

  @ManyToOne(() => Usuarios, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdUsuario", referencedColumnName: "id" }])
  idUsuario2: Usuarios;
}
