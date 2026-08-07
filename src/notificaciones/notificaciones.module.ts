import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Arrendadores } from "src/entities/Arrendadores";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Pago } from "src/entities/Pago";
import { PagosArrendatarios } from "src/entities/PagosArrendatarios";
import { ServiciosArrendatarios } from "src/entities/ServiciosArrendatarios";
import { ServiciosInmuebles } from "src/entities/ServiciosInmuebles";
import { NotificacionesController } from "./notificaciones.controller";
import { NotificacionesService } from "./notificaciones.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContratoArrendatarios,
      ServiciosInmuebles,
      ServiciosArrendatarios,
      Pago,
      PagosArrendatarios,
      Arrendadores,
    ]),
  ],
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
})
export class NotificacionesModule {}
