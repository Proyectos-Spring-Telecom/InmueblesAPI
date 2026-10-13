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
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { ContratosService } from "./contratos.service";
import { PlantillaContratoDto } from "./dto/plantilla-contrato.dto";
import { VistaPreviaPlantillaDto } from "./dto/vista-previa-plantilla.dto";

@ApiTags("Contratos")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("contratos")
export class ContratosController {
  constructor(private readonly contratosService: ContratosService) {}

  @Get("plantilla/subarrendamiento")
  @ApiOperation({
    summary: "Plantilla editable del contrato de subarrendamiento",
    description:
      "Devuelve las secciones y los campos vacíos para que el front arme la pantalla de edición. " +
      "El texto legal no se edita.",
  })
  @ApiOkResponse({ type: PlantillaContratoDto })
  obtenerPlantillaSubarrendamiento() {
    return this.contratosService.obtenerPlantillaSubarrendamiento();
  }

  @Get("plantilla/subarrendamiento/ejemplo")
  @ApiOperation({
    summary: "Plantilla de ejemplo con datos inventados",
    description:
      "Misma plantilla del contrato, con todos los campos llenos, para revisar el contenido antes de capturar un caso real.",
  })
  @ApiOkResponse({ type: PlantillaContratoDto })
  obtenerPlantillaSubarrendamientoEjemplo() {
    return this.contratosService.obtenerPlantillaSubarrendamientoEjemplo();
  }

  @Get("plantilla/subarrendamiento/ejemplo/vista-previa")
  @ApiOperation({
    summary: "PDF de ejemplo del contrato de subarrendamiento",
    description:
      "Genera el PDF con los datos inventados de la plantilla de ejemplo para ver cómo queda el contrato.",
  })
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "PDF del contrato con datos de ejemplo",
    content: {
      "application/pdf": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  async vistaPreviaEjemploSubarrendamiento(@Res() res: Response) {
    const pdf =
      await this.contratosService.generarVistaPreviaEjemploSubarrendamiento();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="contrato-subarrendamiento-ejemplo.pdf"',
    );
    res.send(pdf);
  }

  @Post("plantilla/subarrendamiento/vista-previa")
  @HttpCode(200)
  @ApiOperation({
    summary: "Vista previa en PDF del contrato de subarrendamiento",
    description:
      "Recibe la plantilla con los valores capturados y regresa el PDF para mostrarlo en el visor. " +
      "Los campos vacíos se imprimen en blanco.",
  })
  @ApiBody({ type: VistaPreviaPlantillaDto })
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "PDF del contrato con los datos capturados",
    content: {
      "application/pdf": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  async vistaPreviaSubarrendamiento(
    @Body() dto: VistaPreviaPlantillaDto,
    @Res() res: Response,
  ) {
    const pdf = await this.contratosService.generarVistaPreviaSubarrendamiento(
      dto,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="contrato-subarrendamiento.pdf"',
    );
    res.send(pdf);
  }

  @Post("generados")
  @HttpCode(200)
  @ApiOperation({
    summary: "Guardar el contrato de la vista previa",
    description:
      "Guarda la plantilla capturada en ContratosGenerados, con el usuario que la registra. " +
      "No crea un contrato de arrendatario ni asigna locales.",
  })
  @ApiBody({ type: VistaPreviaPlantillaDto })
  guardarContratoGenerado(
    @Body() dto: VistaPreviaPlantillaDto,
    @Req() req,
  ) {
    return this.contratosService.guardarContratoGenerado(
      dto,
      Number(req.user.userId),
    );
  }

  @Get("generados")
  @ApiOperation({
    summary: "Listar los contratos generados",
    description:
      "Devuelve los contratos guardados desde la vista previa, con el usuario que los registró.",
  })
  listarContratosGenerados() {
    return this.contratosService.listarContratosGenerados();
  }

  @Get("generados/:id")
  @ApiOperation({
    summary: "Obtener un contrato generado para editarlo",
    description:
      "Devuelve la plantilla guardada para volver a abrirla en el editor y regenerar la vista previa.",
  })
  @ApiParam({ name: "id", description: "ID del contrato generado" })
  obtenerContratoGenerado(@Param("id", ParseIntPipe) id: number) {
    return this.contratosService.obtenerContratoGenerado(id);
  }

  @Patch("generados/:id")
  @HttpCode(200)
  @ApiOperation({
    summary: "Actualizar un contrato generado",
    description:
      "Reemplaza la plantilla guardada. El usuario que lo registró no cambia.",
  })
  @ApiParam({ name: "id", description: "ID del contrato generado" })
  @ApiBody({ type: VistaPreviaPlantillaDto })
  actualizarContratoGenerado(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VistaPreviaPlantillaDto,
    @Req() req,
  ) {
    return this.contratosService.actualizarContratoGenerado(
      id,
      dto,
      Number(req.user.userId),
    );
  }

  @Patch("locales/:id/cancelar")
  @HttpCode(200)
  @ApiOperation({
    summary: "Cancelar asignación de local en contrato",
    description:
      "Establece estatus 0 y FechaBaja en ContratoLocales. El local pasa a estatus Disponible.",
  })
  @ApiParam({ name: "id", description: "Id del ContratoLocales" })
  cancelarContratoLocal(@Param("id", ParseIntPipe) id: number) {
    return this.contratosService.cancelarContratoLocal(id);
  }

  @Patch(":id/cancelar")
  @HttpCode(200)
  @ApiOperation({
    summary: "Cancelar contrato de arrendatario",
    description:
      "Establece estatus 0 y FechaBaja en el contrato y da de baja todos sus ContratoLocales activos. " +
      "Los locales vinculados pasan a estatus Disponible.",
  })
  @ApiParam({ name: "id", description: "Id del ContratoArrendatarios" })
  cancelarContrato(@Param("id", ParseIntPipe) id: number) {
    return this.contratosService.cancelarContrato(id);
  }
}
