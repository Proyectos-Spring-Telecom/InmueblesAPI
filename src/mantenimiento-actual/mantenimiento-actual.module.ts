import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Formulas } from "src/entities/Formulas";
import { HistoricoPagosMantenimiento } from "src/entities/HistoricoPagosMantenimiento";
import { MantenimientoActual } from "src/entities/MantenimientoActual";
import { MantenimientoActualController } from "./mantenimiento-actual.controller";
import { MantenimientoActualService } from "./mantenimiento-actual.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MantenimientoActual,
      HistoricoPagosMantenimiento,
      Arrendatarios,
      ContratoArrendatarios,
      Formulas,
    ]),
  ],
  controllers: [MantenimientoActualController],
  providers: [MantenimientoActualService],
  exports: [MantenimientoActualService],
})
export class MantenimientoActualModule {}
