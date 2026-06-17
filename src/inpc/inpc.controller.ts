import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { CreateInpcDto } from "./dto/create-inpc.dto";
import { UpdateInpcDto } from "./dto/update-inpc.dto";
import { InpcService } from "./inpc.service";

@ApiTags("INPC")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("inpc")
export class InpcController {
  constructor(private readonly inpcService: InpcService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: "Registrar INPC" })
  create(@Body() dto: CreateInpcDto, @Req() req: any) {
    return this.inpcService.create(dto, req);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Editar INPC" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateInpcDto,
    @Req() req: any,
  ) {
    return this.inpcService.update(id, dto, req);
  }

  @Patch("desactivar/:id")
  @ApiOperation({ summary: "Dar de baja (estatus 0) un registro INPC" })
  desactivar(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    return this.inpcService.desactivar(id, req);
  }

  @Patch("activar/:id")
  @ApiOperation({ summary: "Dar de alta (estatus 1) un registro INPC" })
  activar(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    return this.inpcService.activar(id, req);
  }

  @Get("listado")
  @ApiOperation({
    summary: "Listar INPC activos (estatus 1) por rango de fechas",
    description:
      "Sin paginación. Solo registros locales con estatus = 1. " +
      "Requiere fechaInicio y fechaFin (YYYY-MM-DD); el rango se interpreta por año/mes.",
  })
  @ApiQuery({ name: "fechaInicio", required: true, example: "2025-01-01" })
  @ApiQuery({ name: "fechaFin", required: true, example: "2025-12-31" })
  findListadoActivos(
    @Query("fechaInicio") fechaInicio: string,
    @Query("fechaFin") fechaFin: string,
  ) {
    if (!fechaInicio || !fechaFin) {
      throw new BadRequestException(
        "Se requieren fechaInicio y fechaFin (formato YYYY-MM-DD).",
      );
    }
    return this.inpcService.findListadoActivos(fechaInicio, fechaFin);
  }

  @Get("paginated")
  @ApiOperation({
    summary: "Listar INPC paginado (local y/o unificado con Banxico)",
    description:
      "Sin fechas: solo registros locales. Con fechaInicio y fechaFin: concatena registros locales " +
      "y datos de Banxico en un arreglo (pueden repetirse meses). Cada item incluye `isBanxico`.",
  })
  @ApiQuery({ name: "fechaInicio", required: false, example: "2025-01-01" })
  @ApiQuery({ name: "fechaFin", required: false, example: "2025-12-31" })
  findAllPaginated(
    @Query("page", ParseIntPipe) page: number,
    @Query("limit", ParseIntPipe) limit: number,
    @Query("fechaInicio") fechaInicio?: string,
    @Query("fechaFin") fechaFin?: string,
  ) {
    return this.inpcService.findAllPaginated(
      page,
      limit,
      fechaInicio,
      fechaFin,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener INPC por ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.inpcService.findOne(id);
  }
}
