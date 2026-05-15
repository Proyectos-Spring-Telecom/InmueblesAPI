import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BitacoraModule } from "src/bitacora/bitacora.module";
import { Inpc } from "src/entities/Inpc";
import { InpcController } from "./inpc.controller";
import { InpcService } from "./inpc.service";

@Module({
  imports: [TypeOrmModule.forFeature([Inpc]), BitacoraModule],
  controllers: [InpcController],
  providers: [InpcService],
  exports: [InpcService],
})
export class InpcModule {}
