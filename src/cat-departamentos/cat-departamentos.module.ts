import { Module } from '@nestjs/common';
import { CatDepartamentosService } from './cat-departamentos.service';
import { CatDepartamentosController } from './cat-departamentos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatDepartamentos } from 'src/entities/CatDepartamentos';
import { Arrendadores } from 'src/entities/Arrendadores';
import { BitacoraModule } from 'src/bitacora/bitacora.module';

@Module({
  imports: [TypeOrmModule.forFeature([CatDepartamentos, Arrendadores]), BitacoraModule],
  controllers: [CatDepartamentosController],
  providers: [CatDepartamentosService],
  exports: [CatDepartamentosService],
})
export class CatDepartamentosModule {}
