import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BitacoraModule } from "src/bitacora/bitacora.module";
import { Inpc } from "src/entities/Inpc";
import { InpcController } from "./inpc.controller";
import { InpcService } from "./inpc.service";
import { InpcBanxicoController } from "./inpc-banxico.controller";
import { BanxicoClientService } from "./services/banxico-client.service";

@Module({
  imports: [TypeOrmModule.forFeature([Inpc]), BitacoraModule, HttpModule],
  controllers: [InpcController, InpcBanxicoController],
  providers: [InpcService, BanxicoClientService],
  exports: [InpcService, BanxicoClientService],
})
export class InpcModule {}
