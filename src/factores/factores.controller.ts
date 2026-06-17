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
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { CreateFactorDto } from "./dto/create-factor.dto";
import { UpdateFactorDto } from "./dto/update-factor.dto";
import { FactoresService } from "./factores.service";

@ApiTags("Factores")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("factores")
export class FactoresController {
  constructor(private readonly factoresService: FactoresService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: "Registrar factor" })
  create(@Body() dto: CreateFactorDto, @Req() req: any) {
    return this.factoresService.create(dto, req);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Editar factor" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateFactorDto,
    @Req() req: any,
  ) {
    return this.factoresService.update(id, dto, req);
  }

  @Patch("desactivar/:id")
  @ApiOperation({ summary: "Dar de baja (estatus 0) un factor" })
  desactivar(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    return this.factoresService.desactivar(id, req);
  }

  @Patch("activar/:id")
  @ApiOperation({ summary: "Dar de alta (estatus 1) un factor" })
  activar(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    return this.factoresService.activar(id, req);
  }

  @Get("listado")
  @ApiOperation({
    summary: "Listar factores activos (estatus 1) sin paginación",
  })
  findAllActivos() {
    return this.factoresService.findAllActivos();
  }

  @Get("paginated")
  @ApiOperation({ summary: "Listar factores paginado" })
  findAllPaginated(
    @Query("page", ParseIntPipe) page: number,
    @Query("limit", ParseIntPipe) limit: number,
  ) {
    return this.factoresService.findAllPaginated(page, limit);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener factor por ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.factoresService.findOne(id);
  }
}
