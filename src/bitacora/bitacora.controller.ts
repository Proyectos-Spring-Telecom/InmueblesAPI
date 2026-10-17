import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ApiResponseCommon } from "src/common/ApiResponse";
import { BitacoraService } from "./bitacora.service";
import {
  BitacoraListResponseDto,
  BitacoraOneResponseDto,
  BitacoraPaginatedResponseDto,
} from "./dto/bitacora-registro.dto";
import { BuscarBitacoraDto } from "./dto/buscar-bitacora.dto";
import { CreateBitacoraDto } from "./dto/create-bitac ora.dto";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";

@ApiTags("Bitácora")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller("bitacora")
export class BitacoraController {
  constructor(private readonly bitacoraService: BitacoraService) { }

  @Post()
  @HttpCode(200)
  create(@Body() createBitacoraDto: CreateBitacoraDto) {
    return this.bitacoraService.createBitacora(createBitacoraDto);
  }

  @Get("list")
  @ApiOperation({
    summary: "Listar todos los registros de bitácora",
    description:
      "Devuelve el historial completo ordenado por fecha descendente, " +
      "con datos del usuario y del módulo asociado.",
  })
  @ApiOkResponse({ type: BitacoraListResponseDto })
  async findAllListBitacora(@Req() req: any): Promise<ApiResponseCommon> {
    return await this.bitacoraService.findAllListBitacora(
      Number(req.user?.cliente || 0),
      Number(req.user?.rol || 0),
    );
  }

  @Post("paginated")
  @HttpCode(200)
  @ApiOperation({
    summary: "Listar bitácora paginada por rango de fechas",
    description:
      "Consulta paginada con joins a Usuarios y Modulos. " +
      "Opcionalmente filtra por `fechaInicio` y/o `fechaFin` sobre `FechaCreacion`. " +
      "Orden: `FechaCreacion` descendente.",
  })
  @ApiBody({ type: BuscarBitacoraDto })
  @ApiOkResponse({ type: BitacoraPaginatedResponseDto })
  findAllPaginated(
    @Body() dto: BuscarBitacoraDto,
    @Req() req: any,
  ): Promise<ApiResponseCommon> {
    return this.bitacoraService.findAllPaginated(
      dto,
      Number(req.user?.cliente || 0),
      Number(req.user?.rol || 0),
    );
  }

  @Get(":id")
  @ApiOperation({
    summary: "Obtener un registro de bitácora por ID",
    description: "Incluye información del usuario y del módulo relacionados.",
  })
  @ApiParam({ name: "id", example: 15, description: "ID del registro de bitácora" })
  @ApiOkResponse({ type: BitacoraOneResponseDto })
  async findOne(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    return await this.bitacoraService.findOne(
      id,
      Number(req.user?.cliente || 0),
      Number(req.user?.rol || 0),
    );
  }
}
