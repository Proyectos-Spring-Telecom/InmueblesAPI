import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BitacoraModule } from "src/bitacora/bitacora.module";
import { Clientes } from "src/entities/Clientes";
import { EmbudoVentas } from "src/entities/EmbudoVentas";
import { EventosEmbudoVentas } from "src/entities/EventosEmbudoVentas";
import { MailServiceModule } from "src/mail-service/mail-service.module";
import { EmbudoVentasController } from "./embudo-ventas.controller";
import { EmbudoVentasCronService } from "./embudo-ventas-cron.service";
import { EmbudoVentasService } from "./embudo-ventas.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([EmbudoVentas, EventosEmbudoVentas, Clientes]),
    BitacoraModule,
    MailServiceModule,
  ],
  controllers: [EmbudoVentasController],
  providers: [EmbudoVentasService, EmbudoVentasCronService],
  exports: [EmbudoVentasService],
})
export class EmbudoVentasModule {}
