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
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
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
  @ApiBody({
    type: CreateRentaActualDto,
    examples: {
      completo: {
        summary: "Renta y mantenimiento",
        value: {
          idArrendatario: 1,
          idContrato: 5,
          total: 15000,
          montoFinal: 15500,
          totalMantenimiento: 3500,
          montoFinalMantenimiento: 3675,
          idFormula: 2,
          factorVariable: 1.05,
          ocupoFormula: 1,
        },
      },
    },
  })
  create(@Body() dto: CreateRentaActualDto) {
    return this.rentaActualService.create(dto);
  }

  @Post(":id/siguiente-mes")
  @HttpCode(200)
  @ApiOperation({
    summary: "Duplicar renta actual al mes siguiente",
    description:
      "Crea un nuevo registro idéntico al indicado, con Mes avanzado un mes " +
      "(ej. 2026-07-01 06:00:00 → 2026-08-01 06:00:00). " +
      "No permite duplicar si EsPeriodo=1. " +
      "Falla si ya existe renta para ese arrendatario + contrato en el mes destino.",
  })
  duplicarSiguienteMes(@Param("id", ParseIntPipe) id: number) {
    return this.rentaActualService.duplicarSiguienteMes(id);
  }

  @Put(":id")
  @HttpCode(200)
  @ApiOperation({
    summary: "Actualizar renta actual por id",
    description: "No permite cambiar arrendatario, contrato ni mes.",
  })
  @ApiBody({
    type: UpdateRentaActualDto,
    examples: {
      montos: {
        summary: "Actualizar montos de renta y mantenimiento",
        value: {
          total: 16000,
          montoFinal: 16500,
          totalMantenimiento: 3800,
          montoFinalMantenimiento: 3990,
          factorVariable: 1.03,
          ocupoFormula: 1,
        },
      },
    },
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
      "Mes actual: copia a HistoricoPagosRenta, marca Pagada=1 y conserva el registro en RentaActual " +
      "(evita duplicar el mismo arrendatario + contrato en el mes). " +
      "Mes anterior: copia al histórico y elimina de RentaActual.",
  })
  marcarPagada(@Param("id", ParseIntPipe) id: number) {
    return this.rentaActualService.marcarPagada(id);
  }

  @Get("paginated")
  @ApiOperation({
    summary: "Listar rentas actuales paginado",
    description:
      "Rol 1: todas. Rol > 1: solo rentas de arrendatarios cuyos arrendadores pertenecen al IdCliente del JWT.",
  })
  findAllPaginated(
    @Req() req: any,
    @Query("page", ParseIntPipe) page: number,
    @Query("limit", ParseIntPipe) limit: number,
  ) {
    const cliente = Number(req.user?.cliente || 0);
    const rol = Number(req.user?.rol || 0);
    return this.rentaActualService.findAllPaginated(
      page,
      limit,
      cliente,
      rol,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener renta actual por id" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.rentaActualService.findOne(id);
  }
}
