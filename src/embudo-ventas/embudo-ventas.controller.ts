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
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { ApiCrudResponse, ApiResponseCommon } from "src/common/ApiResponse";
import { EmbudoVentasCronService } from "./embudo-ventas-cron.service";
import { EmbudoVentasService } from "./embudo-ventas.service";
import { CreateEventoEmbudoVentasDto } from "./dto/create-evento-embudo-ventas.dto";
import { UpdateEmbudoEstatusDto } from "./dto/update-embudo-estatus.dto";
import { UpdateEventoEmbudoVentasDto } from "./dto/update-evento-embudo-ventas.dto";
import { UpdateEventoEstatusDto } from "./dto/update-evento-estatus.dto";

@ApiTags("Embudo de ventas")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("embudo-ventas")
export class EmbudoVentasController {
  constructor(
    private readonly embudoVentasService: EmbudoVentasService,
    private readonly embudoVentasCronService: EmbudoVentasCronService,
  ) {}

  @Post("correo-prueba")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Envía un correo de prueba del resumen diario a luisnm93@gmail.com",
  })
  correoPrueba() {
    return this.embudoVentasCronService.enviarCorreoPrueba();
  }

  @Patch("estatus/:id")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Actualizar el estatus del embudo. Solo el usuario dueño (IdUsuario) puede hacerlo.",
  })
  @ApiParam({ name: "id", description: "ID del embudo de ventas", example: 1 })
  @ApiBody({ type: UpdateEmbudoEstatusDto })
  updateEstatusEmbudo(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEmbudoEstatusDto,
    @Req() req,
  ): Promise<ApiCrudResponse> {
    const idUser = Number(req.user.userId);
    return this.embudoVentasService.updateEstatusEmbudo(
      id,
      dto.estatus,
      idUser,
    );
  }

  @Patch("eventos/estatus/:id")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Actualizar el estatus de un evento del embudo. Solo el usuario dueño puede hacerlo.",
  })
  @ApiParam({ name: "id", description: "ID del evento", example: 1 })
  @ApiBody({ type: UpdateEventoEstatusDto })
  updateEstatusEvento(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEventoEstatusDto,
    @Req() req,
  ): Promise<ApiCrudResponse> {
    const idUser = Number(req.user.userId);
    return this.embudoVentasService.updateEstatusEvento(
      id,
      dto.estatus,
      idUser,
    );
  }

  @Patch("eventos/:id")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Registrar la conclusión de un evento del embudo. El evento pasa a estatus realizada. Solo el usuario dueño puede hacerlo.",
  })
  @ApiParam({ name: "id", description: "ID del evento", example: 1 })
  @ApiBody({ type: UpdateEventoEmbudoVentasDto })
  updateEvento(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEventoEmbudoVentasDto,
    @Req() req,
  ): Promise<ApiCrudResponse> {
    const idUser = Number(req.user.userId);
    return this.embudoVentasService.updateEvento(id, dto, idUser);
  }

  @Post(":idEmbudoVentas/eventos")
  @HttpCode(200)
  @ApiOperation({
    summary: "Registrar un próximo evento del embudo de ventas",
  })
  @ApiParam({
    name: "idEmbudoVentas",
    description: "ID del embudo de ventas",
    example: 1,
  })
  @ApiBody({ type: CreateEventoEmbudoVentasDto })
  createEvento(
    @Param("idEmbudoVentas", ParseIntPipe) idEmbudoVentas: number,
    @Body() dto: CreateEventoEmbudoVentasDto,
    @Req() req,
  ): Promise<ApiCrudResponse> {
    const idUser = Number(req.user.userId);
    const cliente = Number(req.user.cliente);
    const rol = Number(req.user.rol);
    return this.embudoVentasService.createEvento(
      idEmbudoVentas,
      dto,
      idUser,
      cliente,
      rol,
    );
  }

  @Get("medios-comunicacion")
  @ApiOperation({
    summary: "Listado de medios de comunicación del embudo",
  })
  listMediosComunicacion() {
    return this.embudoVentasService.listMediosComunicacion();
  }

  @Get()
  @ApiOperation({
    summary:
      "Listado de embudos para el tablero, con prospecto, usuario asignado y eventos",
  })
  getAllEmbudos(@Req() req): Promise<ApiResponseCommon> {
    const idUsuario = Number(req.user.userId);
    const cliente = Number(req.user.cliente);
    const rol = Number(req.user.rol);
    return this.embudoVentasService.getAllEmbudos(idUsuario, cliente, rol);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Obtener un embudo de ventas con su historial de eventos",
  })
  @ApiParam({ name: "id", description: "ID del embudo de ventas", example: 1 })
  getOneEmbudo(@Param("id", ParseIntPipe) id: number, @Req() req) {
    const idUsuario = Number(req.user.userId);
    const cliente = Number(req.user.cliente);
    const rol = Number(req.user.rol);
    return this.embudoVentasService.getOneEmbudo(id, idUsuario, cliente, rol);
  }
}
