import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IncidenciasService } from './incidencias.service';
import { ApiCrudResponse } from 'src/common/ApiResponse';
import { CreateIncidenciaDto } from './dto/create-incidencia.dto';
import { ApiBearerAuth, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { PerteneceAlCliente } from 'src/common/tenant-access/pertenece-al-cliente.decorator';

@Controller('incidencias')
export class IncidenciasController {
  constructor(private readonly incidenciasService: IncidenciasService) { }

  @Post()
  @ApiOperation({ 
    summary: 'Crear nueva incidencia',
    security: []
  })
  async create(
    @Body() createIncidenciaDto: CreateIncidenciaDto,
  ) {
    return await this.incidenciasService.create(createIncidenciaDto, 1);
  }
  @Get('/hoy/:numeroSerie')
  @ApiBearerAuth('access-token')
  @PerteneceAlCliente('dispositivo', 'numeroSerie')
  @UseGuards(JwtAuthGuard)
  async getIncidencias(@Param('numeroSerie') numeroSerie: string) {
    return await this.incidenciasService.getIncidencias(numeroSerie);
  }


  @Get('ultimo-hit/:numeroSerie')
  @ApiBearerAuth('access-token')
  @PerteneceAlCliente('dispositivo', 'numeroSerie')
  @UseGuards(JwtAuthGuard)
  async getUltimoHit(@Param('numeroSerie') numeroSerie: string) {
    return await this.incidenciasService.findUltimoHit(numeroSerie);
  }

  @Get('rango/:numeroSerie')
  @ApiBearerAuth('access-token')
  @PerteneceAlCliente('dispositivo', 'numeroSerie')
  @UseGuards(JwtAuthGuard)
  async getByRango(
    @Param('numeroSerie') numeroSerie: string,
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin') fechaFin: string,
  ) {
    return await this.incidenciasService.findByRango(numeroSerie, fechaInicio, fechaFin);
  }

  @Get('rango-paginado/:numeroSerie')
  @ApiBearerAuth('access-token')
  @PerteneceAlCliente('dispositivo', 'numeroSerie')
  @UseGuards(JwtAuthGuard)
  async getByRangoPaginado(
    @Param('numeroSerie') numeroSerie: string,
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin') fechaFin: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return await this.incidenciasService.findByRangoPaginado(
      numeroSerie,
      fechaInicio,
      fechaFin,
      Number(page),
      Number(limit),
    );
  }

  @Get('por-hora/:numeroSerie')
  @ApiBearerAuth('access-token')
  @PerteneceAlCliente('dispositivo', 'numeroSerie')
  @UseGuards(JwtAuthGuard)
  async getPorHora(
    @Param('numeroSerie') numeroSerie: string,
    @Query('fecha') fecha: string
  ) {
    return await this.incidenciasService.findPorHora(numeroSerie, fecha);
  }

  @Get('por-hora-rango/:numeroSerie')
  @ApiBearerAuth('access-token')
  @PerteneceAlCliente('dispositivo', 'numeroSerie')
  @UseGuards(JwtAuthGuard)
  async getPorHoraRango(
    @Param('numeroSerie') numeroSerie: string,
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin') fechaFin: string,
  ) {
    return await this.incidenciasService.findPorHoraRango(numeroSerie, fechaInicio, fechaFin);
  }
}
