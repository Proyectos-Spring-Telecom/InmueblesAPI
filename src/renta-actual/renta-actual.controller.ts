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
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { CreateRentaActualDto } from "./dto/create-renta-actual.dto";
import { UpdateRentaActualDto } from "./dto/update-renta-actual.dto";
import { RentaActualService } from "./renta-actual.service";

@ApiTags("Renta Actual")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("renta-actual")
export class RentaActualController {
  constructor(private readonly rentaActualService: RentaActualService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: "Registrar renta actual del mes en curso",
    description:
      "Asigna automáticamente el mes-año actual. Solo un registro activo por idArrendatario + idContrato.",
  })
  create(@Body() dto: CreateRentaActualDto) {
    return this.rentaActualService.create(dto);
  }

  @Put(":id")
  @HttpCode(200)
  @ApiOperation({
    summary: "Actualizar renta actual por id",
    description: "No permite cambiar arrendatario, contrato ni mes.",
  })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateRentaActualDto,
  ) {
    return this.rentaActualService.update(id, dto);
  }

  @Patch(":id/pagada")
  @HttpCode(200)
  @ApiOperation({
    summary: "Marcar renta como pagada",
    description:
      "Mueve el registro a HistoricoPagosRenta con Pagada=1 y lo elimina de RentaActual.",
  })
  marcarPagada(@Param("id", ParseIntPipe) id: number) {
    return this.rentaActualService.marcarPagada(id);
  }

  @Get("paginated")
  @ApiOperation({ summary: "Listar rentas actuales paginado" })
  findAllPaginated(
    @Query("page", ParseIntPipe) page: number,
    @Query("limit", ParseIntPipe) limit: number,
  ) {
    return this.rentaActualService.findAllPaginated(page, limit);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener renta actual por id" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.rentaActualService.findOne(id);
  }
}
