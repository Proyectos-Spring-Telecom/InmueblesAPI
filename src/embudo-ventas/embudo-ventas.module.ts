import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BitacoraModule } from "src/bitacora/bitacora.module";
import { Clientes } from "src/entities/Clientes";
import { EmbudoVentas } from "src/entities/EmbudoVentas";
import { EventosEmbudoVentas } from "src/entities/EventosEmbudoVentas";
import { EmbudoVentasController } from "./embudo-ventas.controller";
import { EmbudoVentasService } from "./embudo-ventas.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([EmbudoVentas, EventosEmbudoVentas, Clientes]),
    BitacoraModule,
  ],
  controllers: [EmbudoVentasController],
  providers: [EmbudoVentasService],
  exports: [EmbudoVentasService],
})
export class EmbudoVentasModule {}
