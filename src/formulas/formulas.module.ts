import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BitacoraModule } from "src/bitacora/bitacora.module";
import { Formulas } from "src/entities/Formulas";
import { FormulasController } from "./formulas.controller";
import { FormulasService } from "./formulas.service";

@Module({
  imports: [TypeOrmModule.forFeature([Formulas]), BitacoraModule],
  controllers: [FormulasController],
  providers: [FormulasService],
  exports: [FormulasService],
})
export class FormulasModule {}
