import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Arrendadores } from "src/entities/Arrendadores";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Formulas } from "src/entities/Formulas";
import { HistoricoPagosRenta } from "src/entities/HistoricoPagosRenta";
import { RentaActual } from "src/entities/RentaActual";
import { HistoricoPagosRentaController } from "./historico-pagos-renta.controller";
import { HistoricoPagosRentaService } from "./historico-pagos-renta.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HistoricoPagosRenta,
      RentaActual,
      Arrendatarios,
      Arrendadores,
      ContratoArrendatarios,
      Formulas,
    ]),
  ],
  controllers: [HistoricoPagosRentaController],
  providers: [HistoricoPagosRentaService],
  exports: [HistoricoPagosRentaService],
})
export class HistoricoPagosRentaModule {}
