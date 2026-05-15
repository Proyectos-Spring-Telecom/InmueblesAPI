import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CatMetodosPago } from "src/entities/CatMetodosPago";
import { Inmuebles } from "src/entities/Inmuebles";
import { Pago } from "src/entities/Pago";
import { ServiciosInmuebles } from "src/entities/ServiciosInmuebles";
import { S3Module } from "src/s3/s3.module";
import { PagoController } from "./pago.controller";
import { PagoService } from "./pago.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pago,
      Inmuebles,
      ServiciosInmuebles,
      CatMetodosPago,
    ]),
    S3Module,
  ],
  controllers: [PagoController],
  providers: [PagoService],
  exports: [PagoService],
})
export class PagoModule {}
