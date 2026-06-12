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
  UseGuards,
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

  @Get("paginated")
  @ApiOperation({
    summary: "Listar histórico de pagos de renta paginado por rango de fechas",
  })
  @ApiQuery({ name: "fechaInicio", required: true, example: "2026-01-01" })
  @ApiQuery({ name: "fechaFin", required: true, example: "2026-12-31" })
  @ApiQuery({ name: "idArrendatario", required: false, type: Number })
  @ApiQuery({ name: "idContrato", required: false, type: Number })
  findAllPaginated(
    @Query("page", ParseIntPipe) page: number,
    @Query("limit", ParseIntPipe) limit: number,
    @Query("fechaInicio") fechaInicio: string,
    @Query("fechaFin") fechaFin: string,
    @Query("idArrendatario") idArrendatario?: string,
    @Query("idContrato") idContrato?: string,
  ) {
    return this.historicoPagosRentaService.findAllPaginated(page, limit, {
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
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener registro de histórico por id" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.historicoPagosRentaService.findOne(id);
  }
}
