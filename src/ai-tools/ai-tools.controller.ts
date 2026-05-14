import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AiToolsService } from './ai-tools.service';
import { ServiceKeyGuard } from 'src/guard/service-key.guard';
import { ApiHeader, ApiTags } from '@nestjs/swagger';

@ApiTags('AI Tools (internal)')
@ApiHeader({
  name: 'X-Service-Key',
  description: 'Clave de servicio interna',
  required: true,
})
@UseGuards(ServiceKeyGuard)
@Controller('ai-tools')
export class AiToolsController {
  constructor(private readonly aiToolsService: AiToolsService) {}

  @Get('clientes')
  async getClientes(
    @Query('estatus') estatus?: number,
    @Query('limit') limit?: number,
  ) {
    return this.aiToolsService.getClientes(estatus, limit);
  }

  @Get('clientes/:id')
  async getClienteById(@Param('id', ParseIntPipe) id: number) {
    return this.aiToolsService.getClienteById(id);
  }

  @Get('clientes/rfc/:rfc')
  async getClienteByRfc(@Param('rfc') rfc: string) {
    return this.aiToolsService.getClienteByRfc(rfc);
  }

  @Get('usuarios')
  async getUsuarios(
    @Query('estatus') estatus?: number,
    @Query('clienteId') clienteId?: number,
    @Query('limit') limit?: number,
  ) {
    return this.aiToolsService.getUsuarios(estatus, clienteId, limit);
  }

  @Get('usuarios/:id')
  async getUsuarioById(@Param('id', ParseIntPipe) id: number) {
    return this.aiToolsService.getUsuarioById(id);
  }

  @Get('usuarios/cliente/:clienteId')
  async getUsuariosByCliente(
    @Param('clienteId', ParseIntPipe) clienteId: number,
  ) {
    return this.aiToolsService.getUsuariosByCliente(clienteId);
  }
}
