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
import { EvaluarFormulaDto } from "./dto/evaluar-formula.dto";
import { UpdateFormulaDto } from "./dto/update-formula.dto";
import { FormulaEngineService } from "./formula-engine.service";
import { FormulasService } from "./formulas.service";

@ApiTags("Formulas")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("formulas")
export class FormulasController {
  constructor(
    private readonly formulasService: FormulasService,
    private readonly formulaEngine: FormulaEngineService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: "Registrar fórmula" })
  create(@Body() dto: CreateFormulaDto, @Req() req: any) {
    return this.formulasService.create(dto, req);
  }

  @Post("evaluar")
  @HttpCode(200)
  @ApiOperation({
    summary: "Evaluar fórmula resolviendo variables desde Factores",
    description:
      "Extrae las variables de la expresión, busca cada una en la tabla Factores, " +
      "sustituye los valores y evalúa. Guarda registro de auditoría.",
  })
  evaluar(@Body() dto: EvaluarFormulaDto, @Req() req: any) {
    return this.formulaEngine.evaluar(dto, req);
  }

  @Post("evaluar/preview")
  @HttpCode(200)
  @ApiOperation({
    summary: "Preview de evaluación sin guardar auditoría",
    description: "Igual que evaluar pero no guarda en FormulaEvaluaciones.",
  })
  preview(@Body() dto: EvaluarFormulaDto, @Req() req: any) {
    return this.formulaEngine.preview(dto, req);
  }

  @Get("evaluar/historial")
  @ApiOperation({ summary: "Historial de evaluaciones de fórmulas" })
  historial(
    @Query("idFormula") idFormula?: string,
    @Query("idContrato") idContrato?: string,
  ) {
    const parsedFormula =
      idFormula != null && idFormula !== ""
        ? Number.parseInt(idFormula, 10)
        : undefined;
    const parsedContrato =
      idContrato != null && idContrato !== ""
        ? Number.parseInt(idContrato, 10)
        : undefined;
    return this.formulaEngine.historial(parsedFormula, parsedContrato);
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

  @Patch(":id")
  @ApiOperation({ summary: "Editar fórmula" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateFormulaDto,
    @Req() req: any,
  ) {
    return this.formulasService.update(id, dto, req);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener fórmula por ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.formulasService.findOne(id);
  }
}
