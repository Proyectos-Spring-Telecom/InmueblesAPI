import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Formulas } from "src/entities/Formulas";
import { HistoricoPagosRenta } from "src/entities/HistoricoPagosRenta";
import { RentaActual } from "src/entities/RentaActual";
import { RentaActualController } from "./renta-actual.controller";
import { RentaActualCronService } from "./renta-actual-cron.service";
import { RentaActualService } from "./renta-actual.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RentaActual,
      HistoricoPagosRenta,
      Arrendatarios,
      ContratoArrendatarios,
      Formulas,
    ]),
  ],
  controllers: [RentaActualController],
  providers: [RentaActualService, RentaActualCronService],
  exports: [RentaActualService],
})
export class RentaActualModule {}
