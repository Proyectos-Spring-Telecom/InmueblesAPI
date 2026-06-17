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
import { CreatePagosArrendatarioDto } from "./dto/create-pagos-arrendatario.dto";
import { UpdatePagosArrendatarioEstatusDto } from "./dto/update-pagos-arrendatario-estatus.dto";
import { PagosArrendatariosService } from "./pagos-arrendatarios.service";

@ApiTags("Pagos Arrendatarios")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("pagos-arrendatarios")
export class PagosArrendatariosController {
  constructor(
    private readonly pagosArrendatariosService: PagosArrendatariosService,
  ) {}

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
        "idArrendatario",
        "fechaPago",
        "monto",
        "ComprobantePagoArchivo",
      ],
      properties: {
        idArrendatario: { type: "integer", example: 1 },
        idServicioArrendatario: { type: "integer", example: 2 },
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
    summary:
      "Registrar pago de arrendatario con comprobante (S3 ComprobantesPagoArrendatarios)",
  })
  registrar(
    @Body() dto: CreatePagosArrendatarioDto,
    @UploadedFile() comprobante: Express.Multer.File,
    @Req() req: any,
  ) {
    const idUser = Number(req?.user?.userId || 0);
    return this.pagosArrendatariosService.registrar(dto, comprobante, idUser);
  }

  @Get("paginated")
  @ApiOperation({
    summary: "Listar pagos de arrendatarios paginado por rango de fechas",
    description:
      "Filtra por `fechaPago` entre fechaInicio y fechaFin (YYYY-MM-DD). " +
      "Opcionalmente por idArrendatario.",
  })
  @ApiQuery({ name: "page", required: true, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: true, type: Number, example: 10 })
  @ApiQuery({ name: "fechaInicio", required: true, example: "2026-01-01" })
  @ApiQuery({ name: "fechaFin", required: true, example: "2026-12-31" })
  @ApiQuery({ name: "idArrendatario", required: false, type: Number })
  findAllPaginated(
    @Query("page", ParseIntPipe) page: number,
    @Query("limit", ParseIntPipe) limit: number,
    @Query("fechaInicio") fechaInicio: string,
    @Query("fechaFin") fechaFin: string,
    @Query("idArrendatario") idArrendatario?: string,
  ) {
    if (!fechaInicio || !fechaFin) {
      throw new BadRequestException(
        "Se requieren fechaInicio y fechaFin (formato YYYY-MM-DD).",
      );
    }

    return this.pagosArrendatariosService.findAllPaginated(page, limit, {
      fechaInicio,
      fechaFin,
      idArrendatario: this.pagosArrendatariosService.assertOptionalInt(
        idArrendatario,
        "idArrendatario",
      ),
    });
  }

  @Patch(":id/estatus")
  @HttpCode(200)
  @ApiOperation({ summary: "Actualizar estatus de un pago de arrendatario por id" })
  @ApiBody({ type: UpdatePagosArrendatarioEstatusDto })
  updateEstatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePagosArrendatarioEstatusDto,
  ) {
    return this.pagosArrendatariosService.updateEstatus(id, dto.estatus);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener pago de arrendatario por ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.pagosArrendatariosService.findOne(id);
  }
}
