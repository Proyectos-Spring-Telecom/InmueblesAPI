import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ArchivosArrendatarios } from "src/entities/ArchivosArrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { ContratoLocales } from "src/entities/ContratoLocales";
import { ServiciosArrendatarios } from "src/entities/ServiciosArrendatarios";
import { SociosArrendatarios } from "src/entities/SociosArrendatarios";
import { S3Module } from "src/s3/s3.module";
import { ArrendatariosController } from "./arrendatarios.controller";
import { ArrendatariosService } from "./arrendatarios.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Arrendatarios,
      ContratoArrendatarios,
      ContratoLocales,
      ServiciosArrendatarios,
      ArchivosArrendatarios,
      SociosArrendatarios,
    ]),
    S3Module,
  ],
  controllers: [ArrendatariosController],
  providers: [ArrendatariosService],
  exports: [ArrendatariosService],
})
export class ArrendatariosModule {}
