import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ArchivosInmuebles } from "src/entities/ArchivosInmuebles";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Inmuebles } from "src/entities/Inmuebles";
import { LocalesZonaInmueble } from "src/entities/LocalesZonaInmueble";
import { Pago } from "src/entities/Pago";
import { PagosArrendatarios } from "src/entities/PagosArrendatarios";
import { RentaActual } from "src/entities/RentaActual";
import { ServiciosInmuebles } from "src/entities/ServiciosInmuebles";
import { ZonasInmuebles } from "src/entities/ZonasInmuebles";
import { S3Module } from "src/s3/s3.module";
import { InmueblesController } from "./inmuebles.controller";
import { InmueblesDashboardService } from "./inmuebles-dashboard.service";
import { InmueblesService } from "./inmuebles.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Inmuebles,
      ServiciosInmuebles,
      ZonasInmuebles,
      LocalesZonaInmueble,
      ContratoArrendatarios,
      ArchivosInmuebles,
      Arrendatarios,
      RentaActual,
      PagosArrendatarios,
      Pago,
    ]),
    S3Module,
  ],
  controllers: [InmueblesController],
  providers: [InmueblesService, InmueblesDashboardService],
  exports: [InmueblesService],
})
export class InmueblesModule {}
