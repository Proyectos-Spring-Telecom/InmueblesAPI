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

  // ─── INMUEBLES ───

  @Get('inmuebles')
  async getInmuebles(
    @Query('idArrendador') idArrendador?: number,
    @Query('estatus') estatus?: number,
    @Query('limit') limit?: number,
  ) {
    return this.aiToolsService.getInmuebles(idArrendador, estatus, limit);
  }

  @Get('inmuebles/:id')
  async getInmuebleById(@Param('id', ParseIntPipe) id: number) {
    return this.aiToolsService.getInmuebleById(id);
  }

  // ─── ARRENDATARIOS ───

  @Get('arrendatarios')
  async getArrendatarios(
    @Query('idArrendador') idArrendador?: number,
    @Query('estatus') estatus?: number,
    @Query('limit') limit?: number,
  ) {
    return this.aiToolsService.getArrendatarios(idArrendador, estatus, limit);
  }

  @Get('arrendatarios/:id')
  async getArrendatarioById(@Param('id', ParseIntPipe) id: number) {
    return this.aiToolsService.getArrendatarioById(id);
  }

  // ─── CONTRATOS ───

  @Get('contratos')
  async getContratos(
    @Query('idArrendatario') idArrendatario?: number,
    @Query('idInmueble') idInmueble?: number,
    @Query('estatus') estatus?: number,
    @Query('limit') limit?: number,
  ) {
    return this.aiToolsService.getContratos(
      idArrendatario,
      idInmueble,
      estatus,
      limit,
    );
  }

  @Get('contratos/:id')
  async getContratoById(@Param('id', ParseIntPipe) id: number) {
    return this.aiToolsService.getContratoById(id);
  }

  // ─── PAGOS ───

  @Get('pagos')
  async getPagos(
    @Query('idInmueble') idInmueble?: number,
    @Query('estatus') estatus?: number,
    @Query('limit') limit?: number,
  ) {
    return this.aiToolsService.getPagos(idInmueble, estatus, limit);
  }

  @Get('pagos/resumen/:idInmueble')
  async getPagosResumen(
    @Param('idInmueble', ParseIntPipe) idInmueble: number,
  ) {
    return this.aiToolsService.getPagosResumen(idInmueble);
  }

  // ─── INPC ───

  @Get('inpc')
  async getInpc(
    @Query('anio') anio?: number,
    @Query('limit') limit?: number,
  ) {
    return this.aiToolsService.getInpc(anio, limit);
  }

  // ─── FACTORES ───

  @Get('factores')
  async getFactores() {
    return this.aiToolsService.getFactores();
  }

  // ─── FORMULAS ───

  @Get('formulas')
  async getFormulas() {
    return this.aiToolsService.getFormulas();
  }
}
