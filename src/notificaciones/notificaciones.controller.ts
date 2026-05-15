import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { NotificacionesService } from "./notificaciones.service";

@ApiTags("notificaciones")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("notificaciones")
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  @ApiOperation({
    summary:
      "Alertas por vencimiento de contratos, pagos de servicios de inmuebles y seguimiento de arrendatarios",
  })
  obtenerNotificaciones() {
    return this.notificacionesService.obtenerNotificaciones();
  }
}
