import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { Arrendadores } from "src/entities/Arrendadores";
import { ArchivosArrendatarios } from "src/entities/ArchivosArrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { ContratoLocales } from "src/entities/ContratoLocales";
import { ServiciosArrendatarios } from "src/entities/ServiciosArrendatarios";
import { SociosArrendatarios } from "src/entities/SociosArrendatarios";
import { HistoricoPagosRenta } from "src/entities/HistoricoPagosRenta";
import { LocalesZonaInmueble } from "src/entities/LocalesZonaInmueble";
import { PagosArrendatarios } from "src/entities/PagosArrendatarios";
import { RentaActual } from "src/entities/RentaActual";
import { Estacionamientos } from "src/entities/Estacionamientos";
import { ZonasInmuebles } from "src/entities/ZonasInmuebles";
import { S3Module } from "src/s3/s3.module";
import { ContratosModule } from "src/contratos/contratos.module";
import { ArrendatariosController } from "./arrendatarios.controller";
import { ArrendatariosDashboardService } from "./arrendatarios-dashboard.service";
import { ArrendatariosService } from "./arrendatarios.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Arrendatarios,
      Arrendadores,
      ContratoArrendatarios,
      ContratoLocales,
      ServiciosArrendatarios,
      ArchivosArrendatarios,
      SociosArrendatarios,
      ZonasInmuebles,
      LocalesZonaInmueble,
      HistoricoPagosRenta,
      RentaActual,
      PagosArrendatarios,
      Estacionamientos,
    ]),
    S3Module,
    ContratosModule,
  ],
  controllers: [ArrendatariosController],
  providers: [ArrendatariosService, ArrendatariosDashboardService],
  exports: [ArrendatariosService],
})
export class ArrendatariosModule {}
