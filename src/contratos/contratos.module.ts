import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { ContratoLocales } from "src/entities/ContratoLocales";
import { LocalesZonaInmueble } from "src/entities/LocalesZonaInmueble";
import { ContratosController } from "./contratos.controller";
import { ContratosService } from "./contratos.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContratoArrendatarios,
      ContratoLocales,
      LocalesZonaInmueble,
    ]),
  ],
  controllers: [ContratosController],
  providers: [ContratosService],
  exports: [ContratosService],
})
export class ContratosModule {}
