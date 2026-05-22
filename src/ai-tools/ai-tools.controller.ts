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
import { ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

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
  @ApiOperation({
    summary: 'Listar inmuebles activos',
    description:
      'Devuelve todos los inmuebles con estatus=1. Filtro opcional por idArrendador. Sin parámetros estatus ni limit.',
  })
  @ApiQuery({
    name: 'idArrendador',
    required: false,
    type: Number,
    description:
      'ID del cliente arrendador (columna IdArrendador). Si se omite, devuelve todos los inmuebles activos.',
  })
  async getInmuebles(@Query('idArrendador') idArrendador?: number) {
    return this.aiToolsService.getInmuebles(idArrendador);
  }

  @Get('inmuebles/:id')
  async getInmuebleById(@Param('id', ParseIntPipe) id: number) {
    return this.aiToolsService.getInmuebleById(id);
  }

  // ─── ARRENDATARIOS ───

  @Get('arrendatarios')
  @ApiOperation({
    summary: 'Listar arrendatarios activos',
    description:
      'Devuelve todos los arrendatarios con estatus=1. Filtro opcional por idArrendador. Sin parámetros estatus ni limit.',
  })
  @ApiQuery({
    name: 'idArrendador',
    required: false,
    type: Number,
    description:
      'ID del cliente arrendador (columna IdArrendador). Si se omite, devuelve todos los arrendatarios activos.',
  })
  async getArrendatarios(@Query('idArrendador') idArrendador?: number) {
    return this.aiToolsService.getArrendatarios(idArrendador);
  }

  @Get('arrendatarios/:id')
  async getArrendatarioById(@Param('id', ParseIntPipe) id: number) {
    return this.aiToolsService.getArrendatarioById(id);
  }

  // ─── CONTRATOS ───

  @Get('contratos')
  @ApiOperation({
    summary: 'Listar contratos activos',
    description:
      'Devuelve todos los contratos con estatus=1. Filtros opcionales por idArrendatario e idInmueble. Sin parámetros estatus ni limit.',
  })
  @ApiQuery({
    name: 'idArrendatario',
    required: false,
    type: Number,
    description: 'ID del arrendatario asociado al contrato.',
  })
  @ApiQuery({
    name: 'idInmueble',
    required: false,
    type: Number,
    description: 'ID del inmueble asociado al contrato.',
  })
  async getContratos(
    @Query('idArrendatario') idArrendatario?: number,
    @Query('idInmueble') idInmueble?: number,
  ) {
    return this.aiToolsService.getContratos(idArrendatario, idInmueble);
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
