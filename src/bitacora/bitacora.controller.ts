import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import {
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
import { CreateBitacoraDto } from "./dto/create-bitac ora.dto";

@ApiTags("Bitácora")
@Controller("bitacora")
export class BitacoraController {
  constructor(private readonly bitacoraService: BitacoraService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: "Registrar evento en bitácora (stub)",
    description:
      "Endpoint de creación manual. En la práctica los módulos registran eventos " +
      "vía `BitacoraService.logToBitacora()` de forma interna.",
  })
  @ApiBody({ type: CreateBitacoraDto })
  @ApiOkResponse({
    description: "Respuesta placeholder del endpoint de creación",
    schema: { type: "string", example: "This action adds a new bitacora" },
  })
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
  async findAllListBitacora(): Promise<ApiResponseCommon> {
    return await this.bitacoraService.findAllListBitacora();
  }

  @Get(":page/:limit")
  @ApiOperation({
    summary: "Listar bitácora paginada",
    description:
      "Consulta paginada con joins a Usuarios y Modulos. " +
      "Orden: `FechaCreacion` descendente.",
  })
  @ApiParam({
    name: "page",
    example: 1,
    description: "Número de página (desde 1)",
  })
  @ApiParam({
    name: "limit",
    example: 10,
    description: "Registros por página",
  })
  @ApiOkResponse({ type: BitacoraPaginatedResponseDto })
  findAll(
    @Param("page", ParseIntPipe) page: number,
    @Param("limit", ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return this.bitacoraService.findAll(page, limit);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Obtener un registro de bitácora por ID",
    description: "Incluye información del usuario y del módulo relacionados.",
  })
  @ApiParam({ name: "id", example: 15, description: "ID del registro de bitácora" })
  @ApiOkResponse({ type: BitacoraOneResponseDto })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return await this.bitacoraService.findOne(id);
  }
}
