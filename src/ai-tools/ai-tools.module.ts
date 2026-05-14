import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiToolsController } from './ai-tools.controller';
import { AiToolsService } from './ai-tools.service';
import { Clientes } from 'src/entities/Clientes';
import { Usuarios } from 'src/entities/Usuarios';
import { ServiceKeyGuard } from 'src/guard/service-key.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Clientes, Usuarios])],
  controllers: [AiToolsController],
  providers: [AiToolsService, ServiceKeyGuard],
})
export class AiToolsModule {}
