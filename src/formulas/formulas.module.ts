import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BitacoraModule } from "src/bitacora/bitacora.module";
import { Formulas } from "src/entities/Formulas";
import { Factores } from "src/entities/Factores";
import { FormulaEvaluaciones } from "src/entities/FormulaEvaluaciones";
import { Inpc } from "src/entities/Inpc";
import { FormulasController } from "./formulas.controller";
import { FormulasService } from "./formulas.service";
import { FormulaEngineService } from "./formula-engine.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Formulas, Factores, FormulaEvaluaciones, Inpc]),
    BitacoraModule,
  ],
  controllers: [FormulasController],
  providers: [FormulasService, FormulaEngineService],
  exports: [FormulasService, FormulaEngineService],
})
export class FormulasModule {}
