import {
  Controller,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { ContratosService } from "./contratos.service";

@ApiTags("Contratos")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("contratos")
export class ContratosController {
  constructor(private readonly contratosService: ContratosService) {}

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
