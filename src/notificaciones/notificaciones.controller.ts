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
      "Alertas: vencimiento de contratos, pagos de servicios de inmuebles y de arrendatarios",
    description:
      "**Alcance:** rol 1 ve todo; rol > 1 solo arrendadores del IdCliente del JWT.\n\n" +
      "**vencimientosRenovacionesContrato:** contratos activos con FechaTerminoContrato.\n\n" +
      "**pagoServiciosInmuebles:** base `ServiciosInmuebles` (día de FechaPago proyectado al mes). " +
      "Si hay `Pago` Pagado del mes → fechaPago al mes siguiente. `estatusPago`: 1 Pagado, 2 Pendiente, null si no aplica.\n\n" +
      "**pagosSeguimiento:** base `ServiciosArrendatarios`.\n" +
      "- **idTipoServicio 3 y 4 (renta/mantenimiento):** el pago del mes se toma de `RentaActual` " +
      "cruzando `ServiciosArrendatarios.IdContrato` = `RentaActual.IdContrato` del mes actual. " +
      "Si `Pagada = 1` → se considera pagado y `fechaPago` avanza al mes siguiente.\n" +
      "- **Otros tipos:** usan `PagosArrendatarios` (Pendiente/Pagado) por IdServicioArrendatario.\n" +
      "- Incluye `idContrato` en cada item cuando aplica.",
  })
  obtenerNotificaciones(@Req() req: any) {
    const cliente = Number(req.user?.cliente || 0);
    const rol = Number(req.user?.rol || 0);
    return this.notificacionesService.obtenerNotificaciones(cliente, rol);
  }
}
