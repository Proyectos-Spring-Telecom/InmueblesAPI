import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { CreateHistoricoPagoRentaDto } from "./dto/create-historico-pago-renta.dto";
import { UpdateHistoricoPagoRentaDto } from "./dto/update-historico-pago-renta.dto";
import { HistoricoPagosRentaService } from "./historico-pagos-renta.service";

@ApiTags("Histórico Pagos Renta")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("historico-pagos-renta")
export class HistoricoPagosRentaController {
  constructor(
    private readonly historicoPagosRentaService: HistoricoPagosRentaService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: "Registrar pago de renta en histórico" })
  create(@Body() dto: CreateHistoricoPagoRentaDto) {
    return this.historicoPagosRentaService.create(dto);
  }

  @Put(":id")
  @HttpCode(200)
  @ApiOperation({ summary: "Actualizar registro de histórico por id" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateHistoricoPagoRentaDto,
  ) {
    return this.historicoPagosRentaService.update(id, dto);
  }

  @Get("ultimo")
  @ApiOperation({
    summary: "Último pago de renta por arrendatario y contrato",
    description:
      "Busca el registro más reciente en HistoricoPagosRenta. Si no existe, " +
      "consulta RentaActual. Incluye `origen` para indicar de qué tabla proviene.",
  })
  @ApiQuery({ name: "idArrendatario", required: true, type: Number })
  @ApiQuery({ name: "idContrato", required: true, type: Number })
  findUltimo(
    @Query("idArrendatario") idArrendatario: string,
    @Query("idContrato") idContrato: string,
  ) {
    return this.historicoPagosRentaService.findUltimo(
      this.historicoPagosRentaService.assertRequiredInt(
        idArrendatario,
        "idArrendatario",
      ),
      this.historicoPagosRentaService.assertRequiredInt(
        idContrato,
        "idContrato",
      ),
    );
  }

  @Get("paginated")
  @ApiOperation({
    summary: "Listar histórico de pagos de renta paginado por rango de fechas",
    description:
      "Filtra por mes calendario de `Mes` entre fechaInicio y fechaFin (YYYY-MM-DD). " +
      "Opcionalmente por idArrendatario e idContrato. " +
      "Rol > 1: solo pagos de arrendatarios cuyos arrendadores pertenecen al cliente del JWT.",
  })
  @ApiQuery({ name: "page", required: true, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: true, type: Number, example: 10 })
  @ApiQuery({ name: "fechaInicio", required: true, example: "2026-01-01" })
  @ApiQuery({ name: "fechaFin", required: true, example: "2026-12-31" })
  @ApiQuery({ name: "idArrendatario", required: false, type: Number })
  @ApiQuery({ name: "idContrato", required: false, type: Number })
  findAllPaginated(
    @Req() req: any,
    @Query("page", ParseIntPipe) page: number,
    @Query("limit", ParseIntPipe) limit: number,
    @Query("fechaInicio") fechaInicio: string,
    @Query("fechaFin") fechaFin: string,
    @Query("idArrendatario") idArrendatario?: string,
    @Query("idContrato") idContrato?: string,
  ) {
    if (!fechaInicio || !fechaFin) {
      throw new BadRequestException(
        "Se requieren fechaInicio y fechaFin (formato YYYY-MM-DD).",
      );
    }

    const cliente = Number(req.user?.cliente || 0);
    const rol = Number(req.user?.rol || 0);

    return this.historicoPagosRentaService.findAllPaginated(
      page,
      limit,
      {
        fechaInicio,
        fechaFin,
        idArrendatario: this.historicoPagosRentaService.assertOptionalInt(
          idArrendatario,
          "idArrendatario",
        ),
        idContrato: this.historicoPagosRentaService.assertOptionalInt(
          idContrato,
          "idContrato",
        ),
      },
      cliente,
      rol,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener registro de histórico por id" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.historicoPagosRentaService.findOne(id);
  }
}
