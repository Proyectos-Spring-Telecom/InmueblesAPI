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
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
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
  @ApiOperation({ summary: "Listar pagos de arrendatarios paginado" })
  findAllPaginated(
    @Query("page", ParseIntPipe) page: number,
    @Query("limit", ParseIntPipe) limit: number,
  ) {
    return this.pagosArrendatariosService.findAllPaginated(page, limit);
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
