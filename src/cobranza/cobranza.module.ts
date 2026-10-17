import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CargoConceptos } from "src/entities/CargoConceptos";
import { Cargos } from "src/entities/Cargos";
import { PagoAplicaciones } from "src/entities/PagoAplicaciones";
import { Pagos } from "src/entities/Pagos";
import { BitacoraModule } from "src/bitacora/bitacora.module";
import { S3Module } from "src/s3/s3.module";
import { CobranzaApiService } from "./cobranza-api.service";
import { CobranzaConsultasService } from "./cobranza-consultas.service";
import { CargosController, EstadoCuentaController, PagosController } from "./cobranza.controller";
import { CobranzaService } from "./cobranza.service";

/** Modelo de cargos, pagos y aplicaciones (pagos parciales). */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Cargos, CargoConceptos, Pagos, PagoAplicaciones]), BitacoraModule, S3Module],
  controllers: [CargosController, PagosController, EstadoCuentaController],
  providers: [CobranzaService, CobranzaConsultasService, CobranzaApiService],
  exports: [CobranzaService, CobranzaConsultasService, TypeOrmModule],
})
export class CobranzaModule {}
