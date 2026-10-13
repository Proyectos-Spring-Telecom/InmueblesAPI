import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Clientes } from "src/entities/Clientes";
import { BitacoraModule } from "src/bitacora/bitacora.module";
import { S3Module } from "src/s3/s3.module";
import { EmbudoVentasModule } from "src/embudo-ventas/embudo-ventas.module";
import { ClientesController } from "./clientes.controller";
import { ClientesService } from "./clientes.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Clientes]),
    BitacoraModule,
    S3Module,
    EmbudoVentasModule,
  ],
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [ClientesService],
})
export class ClientesModule {}
