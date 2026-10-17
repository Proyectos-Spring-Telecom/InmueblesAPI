import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Arrendadores } from "src/entities/Arrendadores";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Formulas } from "src/entities/Formulas";
import { Cargos } from "src/entities/Cargos";
import { RentaActualModule } from "src/renta-actual/renta-actual.module";
import { HistoricoPagosRentaController } from "./historico-pagos-renta.controller";
import { HistoricoPagosRentaService } from "./historico-pagos-renta.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cargos,
      Arrendatarios,
      Arrendadores,
      ContratoArrendatarios,
      Formulas,
    ]),
    RentaActualModule,
  ],
  controllers: [HistoricoPagosRentaController],
  providers: [HistoricoPagosRentaService],
  exports: [HistoricoPagosRentaService],
})
export class HistoricoPagosRentaModule {}
