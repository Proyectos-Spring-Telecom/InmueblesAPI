import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ArchivosInmuebles } from "src/entities/ArchivosInmuebles";
import { Inmuebles } from "src/entities/Inmuebles";
import { ServiciosInmuebles } from "src/entities/ServiciosInmuebles";
import { ZonasInmuebles } from "src/entities/ZonasInmuebles";
import { S3Module } from "src/s3/s3.module";
import { InmueblesController } from "./inmuebles.controller";
import { InmueblesService } from "./inmuebles.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Inmuebles,
      ServiciosInmuebles,
      ZonasInmuebles,
      ArchivosInmuebles,
    ]),
    S3Module,
  ],
  controllers: [InmueblesController],
  providers: [InmueblesService],
  exports: [InmueblesService],
})
export class InmueblesModule {}
