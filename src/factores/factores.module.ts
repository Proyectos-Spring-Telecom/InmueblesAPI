import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BitacoraModule } from "src/bitacora/bitacora.module";
import { Factores } from "src/entities/Factores";
import { FactoresController } from "./factores.controller";
import { FactoresService } from "./factores.service";

@Module({
  imports: [TypeOrmModule.forFeature([Factores]), BitacoraModule],
  controllers: [FactoresController],
  providers: [FactoresService],
  exports: [FactoresService],
})
export class FactoresModule {}
