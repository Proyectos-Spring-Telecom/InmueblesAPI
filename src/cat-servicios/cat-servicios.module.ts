import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BitacoraModule } from "src/bitacora/bitacora.module";
import { CatServicios } from "src/entities/CatServicios";
import { CatServiciosController } from "./cat-servicios.controller";
import { CatServiciosService } from "./cat-servicios.service";

@Module({
  imports: [TypeOrmModule.forFeature([CatServicios]), BitacoraModule],
  controllers: [CatServiciosController],
  providers: [CatServiciosService],
  exports: [CatServiciosService],
})
export class CatServiciosModule {}

