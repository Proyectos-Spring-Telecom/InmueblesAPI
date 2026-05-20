import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EntradasSalidasEstacionamiento } from "src/entities/EntradasSalidasEstacionamiento";
import { Inmuebles } from "src/entities/Inmuebles";
import { EntradasSalidasEstacionamientoController } from "./entradas-salidas-estacionamiento.controller";
import { EntradasSalidasEstacionamientoService } from "./entradas-salidas-estacionamiento.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([EntradasSalidasEstacionamiento, Inmuebles]),
  ],
  controllers: [EntradasSalidasEstacionamientoController],
  providers: [EntradasSalidasEstacionamientoService],
  exports: [EntradasSalidasEstacionamientoService],
})
export class EntradasSalidasEstacionamientoModule {}
