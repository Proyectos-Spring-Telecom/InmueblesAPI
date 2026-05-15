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
import { CreateFormulaDto } from "./dto/create-formula.dto";
import { UpdateFormulaDto } from "./dto/update-formula.dto";
import { FormulasService } from "./formulas.service";

@ApiTags("Formulas")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("formulas")
export class FormulasController {
  constructor(private readonly formulasService: FormulasService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: "Registrar fórmula" })
  create(@Body() dto: CreateFormulaDto, @Req() req: any) {
    return this.formulasService.create(dto, req);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Editar fórmula" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateFormulaDto,
    @Req() req: any,
  ) {
    return this.formulasService.update(id, dto, req);
  }

  @Patch("desactivar/:id")
  @ApiOperation({ summary: "Dar de baja (estatus 0) una fórmula" })
  desactivar(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    return this.formulasService.desactivar(id, req);
  }

  @Patch("activar/:id")
  @ApiOperation({ summary: "Dar de alta (estatus 1) una fórmula" })
  activar(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    return this.formulasService.activar(id, req);
  }

  @Get("paginated")
  @ApiOperation({ summary: "Listar fórmulas paginado" })
  findAllPaginated(
    @Query("page", ParseIntPipe) page: number,
    @Query("limit", ParseIntPipe) limit: number,
  ) {
    return this.formulasService.findAllPaginated(page, limit);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener fórmula por ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.formulasService.findOne(id);
  }
}
