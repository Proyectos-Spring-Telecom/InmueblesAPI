import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiToolsController } from './ai-tools.controller';
import { AiToolsService } from './ai-tools.service';
import { Clientes } from 'src/entities/Clientes';
import { Usuarios } from 'src/entities/Usuarios';
import { Inmuebles } from 'src/entities/Inmuebles';
import { Arrendatarios } from 'src/entities/Arrendatarios';
import { ContratoArrendatarios } from 'src/entities/ContratoArrendatarios';
import { Pago } from 'src/entities/Pago';
import { Inpc } from 'src/entities/Inpc';
import { Factores } from 'src/entities/Factores';
import { Formulas } from 'src/entities/Formulas';
import { ZonasInmuebles } from 'src/entities/ZonasInmuebles';
import { ServiciosInmuebles } from 'src/entities/ServiciosInmuebles';
import { CatServicios } from 'src/entities/CatServicios';
import { CatMetodosPago } from 'src/entities/CatMetodosPago';
import { ServiceKeyGuard } from 'src/guard/service-key.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Clientes,
      Usuarios,
      Inmuebles,
      Arrendatarios,
      ContratoArrendatarios,
      Pago,
      Inpc,
      Factores,
      Formulas,
      ZonasInmuebles,
      ServiciosInmuebles,
      CatServicios,
      CatMetodosPago,
    ]),
  ],
  controllers: [AiToolsController],
  providers: [AiToolsService, ServiceKeyGuard],
})
export class AiToolsModule {}
