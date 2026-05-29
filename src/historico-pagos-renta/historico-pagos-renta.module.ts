import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HistoricoPagosRenta } from "src/entities/HistoricoPagosRenta";
import { HistoricoPagosRentaController } from "./historico-pagos-renta.controller";
import { HistoricoPagosRentaService } from "./historico-pagos-renta.service";

@Module({
  imports: [TypeOrmModule.forFeature([HistoricoPagosRenta])],
  controllers: [HistoricoPagosRentaController],
  providers: [HistoricoPagosRentaService],
  exports: [HistoricoPagosRentaService],
})
export class HistoricoPagosRentaModule {}
