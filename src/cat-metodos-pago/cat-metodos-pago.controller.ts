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
import { CatMetodosPagoService } from "./cat-metodos-pago.service";
import { CreateCatMetodoPagoDto } from "./dto/create-cat-metodo-pago.dto";
import { UpdateCatMetodoPagoDto } from "./dto/update-cat-metodo-pago.dto";

@ApiTags("Catalogo Metodos de Pago")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("cat-metodos-pago")
export class CatMetodosPagoController {
  constructor(
    private readonly catMetodosPagoService: CatMetodosPagoService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: "Registrar método de pago" })
  create(@Body() dto: CreateCatMetodoPagoDto, @Req() req: any) {
    return this.catMetodosPagoService.create(dto, req);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Editar método de pago" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCatMetodoPagoDto,
    @Req() req: any,
  ) {
    return this.catMetodosPagoService.update(id, dto, req);
  }

  @Patch("desactivar/:id")
  @ApiOperation({ summary: "Dar de baja (estatus 0) un método de pago" })
  desactivar(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    return this.catMetodosPagoService.desactivar(id, req);
  }

  @Patch("activar/:id")
  @ApiOperation({ summary: "Dar de alta (estatus 1) un método de pago" })
  activar(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    return this.catMetodosPagoService.activar(id, req);
  }

  @Get("paginated")
  @ApiOperation({ summary: "Listar métodos de pago paginado" })
  findAllPaginated(
    @Query("page", ParseIntPipe) page: number,
    @Query("limit", ParseIntPipe) limit: number,
  ) {
    return this.catMetodosPagoService.findAllPaginated(page, limit);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener método de pago por ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.catMetodosPagoService.findOne(id);
  }
}
