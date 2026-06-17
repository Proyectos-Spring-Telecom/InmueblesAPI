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
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import * as multer from "multer";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { CreatePagoDto } from "./dto/create-pago.dto";
import { UpdatePagoEstatusDto } from "./dto/update-pago-estatus.dto";
import { PagoService } from "./pago.service";

@ApiTags("Pago")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("pago")
export class PagoController {
  constructor(private readonly pagoService: PagoService) {}

  @Post()
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor("ComprobantePagoArchivo", {
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = [
          "image/png",
          "image/jpeg",
          "image/jpg",
          "application/pdf",
        ];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new Error("Solo se permiten PNG, JPG, JPEG o PDF") as any,
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: [
        "idInmueble",
        "fechaPago",
        "monto",
        "ComprobantePagoArchivo",
      ],
      properties: {
        idInmueble: { type: "integer", example: 1 },
        idServicioInmueble: { type: "integer", example: 2 },
        concepto: { type: "string", example: "Renta mensual" },
        fechaPago: {
          type: "string",
          format: "date-time",
          example: "2026-05-15T12:00:00.000Z",
        },
        monto: { type: "number", example: 15000.5 },
        idMetodoPago: { type: "integer", example: 1 },
        estatus: {
          type: "integer",
          example: 1,
          description: "Pendiente=2, Pagado=1, Cancelado=0",
        },
        ComprobantePagoArchivo: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiOperation({
    summary: "Registrar pago con comprobante (sube a S3 ComprobantesPagoInmuebles)",
  })
  registrar(
    @Body() dto: CreatePagoDto,
    @UploadedFile() comprobante: Express.Multer.File,
    @Req() req: any,
  ) {
    const idUser = Number(req?.user?.userId || 0);
    return this.pagoService.registrar(dto, comprobante, idUser);
  }

  @Get("paginated")
  @ApiOperation({
    summary: "Listar pagos de inmuebles paginado por rango de fechas",
    description:
      "Filtra por `fechaPago` entre fechaInicio y fechaFin (YYYY-MM-DD). " +
      "Opcionalmente por idInmueble.",
  })
  @ApiQuery({ name: "page", required: true, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: true, type: Number, example: 10 })
  @ApiQuery({ name: "fechaInicio", required: true, example: "2026-01-01" })
  @ApiQuery({ name: "fechaFin", required: true, example: "2026-12-31" })
  @ApiQuery({ name: "idInmueble", required: false, type: Number })
  findAllPaginated(
    @Query("page", ParseIntPipe) page: number,
    @Query("limit", ParseIntPipe) limit: number,
    @Query("fechaInicio") fechaInicio: string,
    @Query("fechaFin") fechaFin: string,
    @Query("idInmueble") idInmueble?: string,
  ) {
    if (!fechaInicio || !fechaFin) {
      throw new BadRequestException(
        "Se requieren fechaInicio y fechaFin (formato YYYY-MM-DD).",
      );
    }

    return this.pagoService.findAllPaginated(page, limit, {
      fechaInicio,
      fechaFin,
      idInmueble: this.pagoService.assertOptionalInt(idInmueble, "idInmueble"),
    });
  }

  @Patch(":id/estatus")
  @HttpCode(200)
  @ApiOperation({ summary: "Actualizar estatus de un pago por id" })
  @ApiBody({ type: UpdatePagoEstatusDto })
  updateEstatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePagoEstatusDto,
  ) {
    return this.pagoService.updateEstatus(id, dto.estatus);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener pago por ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.pagoService.findOne(id);
  }
}
