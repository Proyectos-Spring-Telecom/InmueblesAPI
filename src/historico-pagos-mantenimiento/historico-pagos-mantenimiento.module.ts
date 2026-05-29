import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HistoricoPagosMantenimiento } from "src/entities/HistoricoPagosMantenimiento";
import { HistoricoPagosMantenimientoController } from "./historico-pagos-mantenimiento.controller";
import { HistoricoPagosMantenimientoService } from "./historico-pagos-mantenimiento.service";

@Module({
  imports: [TypeOrmModule.forFeature([HistoricoPagosMantenimiento])],
  controllers: [HistoricoPagosMantenimientoController],
  providers: [HistoricoPagosMantenimientoService],
  exports: [HistoricoPagosMantenimientoService],
})
export class HistoricoPagosMantenimientoModule {}
