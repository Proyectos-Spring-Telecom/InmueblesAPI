import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Formulas } from "src/entities/Formulas";
import { HistoricoPagosRenta } from "src/entities/HistoricoPagosRenta";
import { HistoricoPagosRentaController } from "./historico-pagos-renta.controller";
import { HistoricoPagosRentaService } from "./historico-pagos-renta.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HistoricoPagosRenta,
      Arrendatarios,
      ContratoArrendatarios,
      Formulas,
    ]),
  ],
  controllers: [HistoricoPagosRentaController],
  providers: [HistoricoPagosRentaService],
  exports: [HistoricoPagosRentaService],
})
export class HistoricoPagosRentaModule {}
