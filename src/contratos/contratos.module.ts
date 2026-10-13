import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BitacoraModule } from "src/bitacora/bitacora.module";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { ContratoLocales } from "src/entities/ContratoLocales";
import { ContratosGenerados } from "src/entities/ContratosGenerados";
import { LocalesZonaInmueble } from "src/entities/LocalesZonaInmueble";
import { ContratosController } from "./contratos.controller";
import { ContratosService } from "./contratos.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContratoArrendatarios,
      ContratoLocales,
      ContratosGenerados,
      LocalesZonaInmueble,
    ]),
    BitacoraModule,
  ],
  controllers: [ContratosController],
  providers: [ContratosService],
  exports: [ContratosService],
})
export class ContratosModule {}
