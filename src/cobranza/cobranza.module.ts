import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CargoConceptos } from "src/entities/CargoConceptos";
import { Cargos } from "src/entities/Cargos";
import { PagoAplicaciones } from "src/entities/PagoAplicaciones";
import { Pagos } from "src/entities/Pagos";
import { CobranzaConsultasService } from "./cobranza-consultas.service";
import { CobranzaService } from "./cobranza.service";

/** Modelo de cargos, pagos y aplicaciones (pagos parciales). */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Cargos, CargoConceptos, Pagos, PagoAplicaciones])],
  providers: [CobranzaService, CobranzaConsultasService],
  exports: [CobranzaService, CobranzaConsultasService, TypeOrmModule],
})
export class CobranzaModule {}
