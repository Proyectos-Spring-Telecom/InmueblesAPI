import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { ServiciosInmuebles } from "src/entities/ServiciosInmuebles";
import { NotificacionesController } from "./notificaciones.controller";
import { NotificacionesService } from "./notificaciones.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContratoArrendatarios,
      ServiciosInmuebles,
      Arrendatarios,
    ]),
  ],
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
})
export class NotificacionesModule {}
