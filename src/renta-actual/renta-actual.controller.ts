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
    summary: "Registrar renta actual",
    description:
      "El front envía `fechaInicio` (se guarda en Mes). " +
      "Rechaza mes duplicado o solapamiento con otro periodo/mes del mismo año " +
      "para el mismo arrendatario + contrato (incluye histórico).",
  })
  @ApiBody({
    type: CreateRentaActualDto,
    examples: {
      completo: {
        summary: "Renta y mantenimiento",
        value: {
          idArrendatario: 1,
          idContrato: 5,
          fechaInicio: "2026-08-01T00:00:00.000Z",
          total: 15000,
          montoFinal: 15500,
          totalMantenimiento: 3500,
          montoFinalMantenimiento: 3675,
          fechaFin: "2026-09-30T00:00:00.000Z",
          usaFormula: 1,
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
  @PerteneceAlCliente('cargo')
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
  @PerteneceAlCliente('cargo')
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
          fechaFin: "2026-09-30T00:00:00.000Z",
          usaFormula: 1,
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
  @PerteneceAlCliente('cargo')
  @HttpCode(200)
  @ApiOperation({
    summary: "Marcar renta como pagada",
    description:
      "Registra un pago por el saldo pendiente del cargo y lo aplica (renta y mantenimiento). " +
      "El cargo queda liquidado y aparece en el histórico; no cambia de tabla. " +
      "Se permite aunque el contrato esté cancelado.",
  })
  marcarPagada(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    return this.rentaActualService.marcarPagada(id, Number(req.user?.userId) || null);
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
  @PerteneceAlCliente('cargo')
  @ApiOperation({ summary: "Obtener renta actual por id" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.rentaActualService.findOne(id);
  }
}
