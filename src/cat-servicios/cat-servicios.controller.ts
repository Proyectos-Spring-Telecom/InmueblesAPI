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
import { ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { CatServiciosService } from "./cat-servicios.service";
import { CreateCatServicioDto } from "./dto/create-cat-servicio.dto";
import { UpdateCatServicioDto } from "./dto/update-cat-servicio.dto";

@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("cat-servicios")
export class CatServiciosController {
  constructor(private readonly catServiciosService: CatServiciosService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: "Registrar servicio" })
  create(@Body() dto: CreateCatServicioDto, @Req() req: any) {
    return this.catServiciosService.create(dto, req);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Editar servicio" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCatServicioDto,
    @Req() req: any,
  ) {
    return this.catServiciosService.update(id, dto, req);
  }

  @Patch("desactivar/:id")
  @ApiOperation({ summary: "Dar de baja (desactivar) un servicio" })
  desactivar(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    return this.catServiciosService.desactivar(id, req);
  }

  @Patch("activar/:id")
  @ApiOperation({ summary: "Dar de alta (activar) un servicio" })
  activar(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    return this.catServiciosService.activar(id, req);
  }

  @Get("paginated")
  @ApiOperation({ summary: "Obtener servicios paginados" })
  findAllPaginated(
    @Query("page", ParseIntPipe) page: number,
    @Query("limit", ParseIntPipe) limit: number,
  ) {
    return this.catServiciosService.findAllPaginated(page, limit);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener servicio por ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.catServiciosService.findOne(id);
  }
}

