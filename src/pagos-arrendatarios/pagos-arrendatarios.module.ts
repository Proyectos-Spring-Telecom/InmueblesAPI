import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { CatMetodosPago } from "src/entities/CatMetodosPago";
import { PagosArrendatarios } from "src/entities/PagosArrendatarios";
import { ServiciosArrendatarios } from "src/entities/ServiciosArrendatarios";
import { S3Module } from "src/s3/s3.module";
import { PagosArrendatariosController } from "./pagos-arrendatarios.controller";
import { PagosArrendatariosService } from "./pagos-arrendatarios.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PagosArrendatarios,
      Arrendatarios,
      ServiciosArrendatarios,
      CatMetodosPago,
    ]),
    S3Module,
  ],
  controllers: [PagosArrendatariosController],
  providers: [PagosArrendatariosService],
  exports: [PagosArrendatariosService],
})
export class PagosArrendatariosModule {}
