import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import * as multer from "multer";
import { PerteneceAlCliente } from "src/common/tenant-access/pertenece-al-cliente.decorator";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { CobranzaApiService } from "./cobranza-api.service";
import {
  AplicarPagoDto,
  CancelarDto,
  CrearCargoDto,
  EstadoCuentaQuery,
  ListarCargosQuery,
  ListarPagosQuery,
  RegistrarPagoDto,
} from "./dto/cobranza.dto";

const COMPROBANTE_OPTIONS = {
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: { mimetype: string }, cb: (error: Error | null, accept: boolean) => void) => {
    const permitidos = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
    if (!permitidos.includes(file.mimetype)) {
      // BadRequestException: un archivo no permitido es error del cliente (400), no del servidor.
      return cb(new BadRequestException("El comprobante debe ser PNG, JPG o PDF"), false);
    }
    cb(null, true);
  },
};

@ApiTags("Cobranza: cargos")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller("cargos")
export class CargosController {
  constructor(private readonly api: CobranzaApiService) {}

  @Get()
  @ApiOperation({
    summary: "Listar cargos con saldo y estado de pago",
    description:
      "Filtros: idArrendatario, idContrato, clase (RENTA | SERVICIO | OTRO), " +
      "estado (PENDIENTE | PARCIAL | PAGADO | CANCELADO | CON_SALDO), fechaInicio/fechaFin (fecha del cargo).",
  })
  listar(@Query() q: ListarCargosQuery, @Req() req: any) {
    return this.api.listarCargos(q, req.user);
  }

  @Get(":id")
  @PerteneceAlCliente("cargo")
  @ApiOperation({ summary: "Detalle de un cargo: conceptos, aplicaciones y pagos" })
  obtener(@Param("id", ParseIntPipe) id: number) {
    return this.api.obtenerCargo(id);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: "Registrar un cargo de servicio u otro concepto",
    description:
      "Para servicios (luz, agua…) u otros cobros, en cualquier fecha. Las rentas se generan con /renta-actual. " +
      "No se permiten cargos nuevos para contratos cancelados.",
  })
  crear(@Body() dto: CrearCargoDto, @Req() req: any) {
    return this.api.crearCargo(dto, req.user);
  }

  @Patch(":id/cancelar")
  @PerteneceAlCliente("cargo")
  @ApiOperation({ summary: "Cancelar un cargo sin pagos aplicados" })
  cancelar(@Param("id", ParseIntPipe) id: number, @Body() dto: CancelarDto, @Req() req: any) {
    return this.api.cancelarCargo(id, dto.motivo, req.user);
  }
}

@ApiTags("Cobranza: pagos")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller("pagos")
export class PagosController {
  constructor(private readonly api: CobranzaApiService) {}

  @Post()
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("comprobante", COMPROBANTE_OPTIONS))
  @ApiConsumes("multipart/form-data", "application/json")
  @ApiBody({ type: RegistrarPagoDto })
  @ApiOperation({
    summary: "Registrar un pago recibido (total, parcial o con excedente)",
    description:
      "Registra el dinero recibido y, opcionalmente, lo aplica a conceptos de cargos (`aplicaciones`). " +
      "Lo no aplicado queda como saldo a favor. Comprobante opcional en el campo `comprobante` (PNG, JPG o PDF).",
  })
  registrar(@Body() dto: RegistrarPagoDto, @UploadedFile() comprobante: Express.Multer.File | undefined, @Req() req: any) {
    return this.api.registrarPago(dto, comprobante, req.user);
  }

  @Get()
  @ApiOperation({
    summary: "Listar pagos recibidos",
    description: "Filtros: idArrendatario, estatus (1 confirmado, 2 por confirmar, 0 cancelado), fechaInicio/fechaFin, conDisponible=true (saldo a favor).",
  })
  listar(@Query() q: ListarPagosQuery, @Req() req: any) {
    return this.api.listarPagos(q, req.user);
  }

  @Get(":id")
  @PerteneceAlCliente("pago")
  @ApiOperation({ summary: "Detalle de un pago y sus aplicaciones" })
  obtener(@Param("id", ParseIntPipe) id: number) {
    return this.api.obtenerPago(id);
  }

  @Post(":id/aplicaciones")
  @HttpCode(200)
  @PerteneceAlCliente("pago")
  @ApiOperation({
    summary: "Aplicar el disponible de un pago (saldo a favor) a conceptos de cargos",
    description: "Cada aplicación no puede exceder el saldo del concepto ni el disponible del pago.",
  })
  aplicar(@Param("id", ParseIntPipe) id: number, @Body() dto: AplicarPagoDto, @Req() req: any) {
    return this.api.aplicarPago(id, dto.aplicaciones, req.user);
  }

  @Delete(":id/aplicaciones/:idAplicacion")
  @PerteneceAlCliente("pago")
  @ApiOperation({ summary: "Anular una aplicación; el monto vuelve a ser saldo a favor del pago" })
  anularAplicacion(
    @Param("id", ParseIntPipe) id: number,
    @Param("idAplicacion", ParseIntPipe) idAplicacion: number,
    @Req() req: any,
  ) {
    return this.api.anularAplicacion(id, idAplicacion, req.user);
  }

  @Patch(":id/cancelar")
  @PerteneceAlCliente("pago")
  @ApiOperation({ summary: "Cancelar un pago mal registrado; sus aplicaciones se anulan y los saldos se recalculan" })
  cancelar(@Param("id", ParseIntPipe) id: number, @Body() dto: CancelarDto, @Req() req: any) {
    return this.api.cancelarPago(id, dto.motivo, req.user);
  }
}

@ApiTags("Cobranza: estado de cuenta")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller("arrendatarios")
export class EstadoCuentaController {
  constructor(private readonly api: CobranzaApiService) {}

  @Get(":idArrendatario/estado-cuenta")
  @PerteneceAlCliente("arrendatario", "idArrendatario")
  @ApiOperation({
    summary: "Estado de cuenta del arrendatario",
    description:
      "Resumen (saldo total, vencido, del periodo actual y a favor), cargos con saldo más los del rango, " +
      "y pagos del rango más los que tienen saldo a favor. Sin rango: todos los cargos con saldo y todos los pagos.",
  })
  estadoCuenta(@Param("idArrendatario", ParseIntPipe) idArrendatario: number, @Query() q: EstadoCuentaQuery) {
    return this.api.estadoCuenta(idArrendatario, q);
  }
}
