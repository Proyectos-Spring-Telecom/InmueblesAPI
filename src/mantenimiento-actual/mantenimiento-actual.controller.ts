import { PerteneceAlCliente } from "src/common/tenant-access/pertenece-al-cliente.decorator";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { CreateMantenimientoActualDto } from "./dto/create-mantenimiento-actual.dto";
import { UpdateMantenimientoActualDto } from "./dto/update-mantenimiento-actual.dto";
import { MantenimientoActualService } from "./mantenimiento-actual.service";

@ApiTags("Mantenimiento Actual")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("mantenimiento-actual")
export class MantenimientoActualController {
  constructor(
    private readonly mantenimientoActualService: MantenimientoActualService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: "Registrar mantenimiento actual del mes en curso",
    description:
      "Asigna automáticamente el mes-año actual. Solo un registro activo por idArrendatario + idContrato.",
  })
  create(@Body() dto: CreateMantenimientoActualDto) {
    return this.mantenimientoActualService.create(dto);
  }

  @Put(":id")
  @PerteneceAlCliente('mantenimientoActual')
  @HttpCode(200)
  @ApiOperation({
    summary: "Actualizar mantenimiento actual por id",
    description: "No permite cambiar arrendatario, contrato ni mes.",
  })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMantenimientoActualDto,
  ) {
    return this.mantenimientoActualService.update(id, dto);
  }

  @Patch(":id/pagada")
  @PerteneceAlCliente('mantenimientoActual')
  @HttpCode(200)
  @ApiOperation({
    summary: "Marcar mantenimiento como pagado",
    description:
      "Mueve el registro a HistoricoPagosMantenimiento con Pagada=1 y lo elimina de MantenimientoActual.",
  })
  marcarPagada(@Param("id", ParseIntPipe) id: number) {
    return this.mantenimientoActualService.marcarPagada(id);
  }

  @Get("paginated")
  @ApiOperation({ summary: "Listar mantenimientos actuales paginado" })
  findAllPaginated(
    @Req() req: any,
    @Query("page", ParseIntPipe) page: number,
    @Query("limit", ParseIntPipe) limit: number,
  ) {
    return this.mantenimientoActualService.findAllPaginated(
      page,
      limit,
      Number(req.user?.cliente || 0),
      Number(req.user?.rol || 0),
    );
  }

  @Get(":id")
  @PerteneceAlCliente('mantenimientoActual')
  @ApiOperation({ summary: "Obtener mantenimiento actual por id" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.mantenimientoActualService.findOne(id);
  }
}
