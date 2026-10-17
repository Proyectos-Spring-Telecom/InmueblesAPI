import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Formulas } from "src/entities/Formulas";
import { Cargos } from "src/entities/Cargos";
import { RentaActualController } from "./renta-actual.controller";
import { RentaActualService } from "./renta-actual.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cargos,
      Arrendatarios,
      ContratoArrendatarios,
      Formulas,
    ]),
  ],
  controllers: [RentaActualController],
  providers: [RentaActualService],
  exports: [RentaActualService],
})
export class RentaActualModule {}
