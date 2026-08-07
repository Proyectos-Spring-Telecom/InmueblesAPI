import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { NotificacionesService } from "./notificaciones.service";

@ApiTags("Notificaciones")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("notificaciones")
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  @ApiOperation({
    summary:
      "Alertas por vencimiento de contratos, pagos de servicios de inmuebles y de arrendatarios",
    description:
      "Rol 1: ve todo. Rol > 1: solo datos de arrendadores del IdCliente del JWT. " +
      "pagoServiciosInmuebles / pagosSeguimiento se forman con ServiciosInmuebles / ServiciosArrendatarios; " +
      "FechaPago se proyecta al mes actual; se ocultan si ya hay Pago / PagosArrendatarios Pagado en ese mes.",
  })
  obtenerNotificaciones(@Req() req: any) {
    const cliente = Number(req.user?.cliente || 0);
    const rol = Number(req.user?.rol || 0);
    return this.notificacionesService.obtenerNotificaciones(cliente, rol);
  }
}
