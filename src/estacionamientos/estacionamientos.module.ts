import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { Estacionamientos } from "src/entities/Estacionamientos";
import { Inmuebles } from "src/entities/Inmuebles";
import { EstacionamientosController } from "./estacionamientos.controller";
import { EstacionamientosService } from "./estacionamientos.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Estacionamientos,
      Inmuebles,
      Arrendatarios,
    ]),
  ],
  controllers: [EstacionamientosController],
  providers: [EstacionamientosService],
  exports: [EstacionamientosService],
})
export class EstacionamientosModule {}
