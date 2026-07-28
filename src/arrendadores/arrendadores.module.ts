import { Module } from '@nestjs/common';
import { ArrendadoresService } from './arrendadores.service';
import { ArrendadoresController } from './arrendadores.controller';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { S3Module } from 'src/s3/s3.module';
import { Arrendadores } from 'src/entities/Arrendadores';
import { SociosArrendadores } from 'src/entities/SociosArrendadores';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([Arrendadores, SociosArrendadores]),
    BitacoraModule,
    S3Module,
  ],
  controllers: [ArrendadoresController],
  providers: [ArrendadoresService],
  exports: [ArrendadoresService]
})
export class ArrendadoresModule {}
