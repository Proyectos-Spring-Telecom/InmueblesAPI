import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BitacoraModule } from "src/bitacora/bitacora.module";
import { CatMetodosPago } from "src/entities/CatMetodosPago";
import { CatMetodosPagoController } from "./cat-metodos-pago.controller";
import { CatMetodosPagoService } from "./cat-metodos-pago.service";

@Module({
  imports: [TypeOrmModule.forFeature([CatMetodosPago]), BitacoraModule],
  controllers: [CatMetodosPagoController],
  providers: [CatMetodosPagoService],
  exports: [CatMetodosPagoService],
})
export class CatMetodosPagoModule {}
