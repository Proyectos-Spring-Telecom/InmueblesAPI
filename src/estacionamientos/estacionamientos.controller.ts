import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { CreateEstacionamientoDto } from "./dto/create-estacionamiento.dto";
import { UpdateEstacionamientoDto } from "./dto/update-estacionamiento.dto";
import { UpdateEstacionamientoEstatusDto } from "./dto/update-estacionamiento-estatus.dto";
import { EstacionamientosService } from "./estacionamientos.service";

@ApiTags("Estacionamientos")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("estacionamientos")
export class EstacionamientosController {
  constructor(
    private readonly estacionamientosService: EstacionamientosService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: "Registrar estacionamiento (estatus 1 activo por defecto).",
  })
  create(@Body() dto: CreateEstacionamientoDto) {
    return this.estacionamientosService.create(dto);
  }

  @Patch("desactivar/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Dar de baja estacionamiento (estatus 0)." })
  desactivar(@Param("id", ParseIntPipe) id: number) {
    return this.estacionamientosService.desactivar(id);
  }

  @Patch("activar/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Activar estacionamiento (estatus 1)." })
  activar(@Param("id", ParseIntPipe) id: number) {
    return this.estacionamientosService.activar(id);
  }

  @Patch(":id/estatus")
  @HttpCode(200)
  @ApiOperation({ summary: "Cambiar estatus (0 baja, 1 activo)." })
  @ApiBody({ type: UpdateEstacionamientoEstatusDto })
  updateEstatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEstacionamientoEstatusDto,
  ) {
    return this.estacionamientosService.updateEstatus(id, dto.estatus);
  }

  @Patch(":id")
  @HttpCode(200)
  @ApiOperation({ summary: "Actualizar datos del estacionamiento." })
  @ApiBody({ type: UpdateEstacionamientoDto })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEstacionamientoDto,
  ) {
    return this.estacionamientosService.update(id, dto);
  }

  @Get("inmueble/:idInmueble")
  @ApiOperation({
    summary: "Listar estacionamientos por idInmueble.",
  })
  findByIdInmueble(
    @Req() req: any,
    @Param("idInmueble", ParseIntPipe) idInmueble: number,
  ) {
    const rol = Number(req.user?.rol || 0);
    return this.estacionamientosService.findByIdInmueble(idInmueble, rol);
  }

  @Get("arrendatario/:idArrendatario")
  @ApiOperation({
    summary: "Listar estacionamientos por idArrendatario.",
  })
  findByIdArrendatario(
    @Req() req: any,
    @Param("idArrendatario", ParseIntPipe) idArrendatario: number,
  ) {
    const rol = Number(req.user?.rol || 0);
    return this.estacionamientosService.findByIdArrendatario(
      idArrendatario,
      rol,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener estacionamiento por ID." })
  findOne(@Req() req: any, @Param("id", ParseIntPipe) id: number) {
    const rol = Number(req.user?.rol || 0);
    return this.estacionamientosService.findOne(id, rol);
  }
}
