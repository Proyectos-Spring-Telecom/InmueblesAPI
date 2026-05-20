import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
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
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import * as multer from "multer";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { QueryEntradasSalidasPaginatedDto } from "./dto/query-entradas-salidas-paginated.dto";
import { EntradasSalidasEstacionamientoService } from "./entradas-salidas-estacionamiento.service";

const EXCEL_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

@ApiTags("Entradas Salidas Estacionamiento")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("entradas-salidas-estacionamiento")
export class EntradasSalidasEstacionamientoController {
  constructor(
    private readonly service: EntradasSalidasEstacionamientoService,
  ) {}

  @Post("importar")
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor("archivo", {
      storage: multer.memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = file.originalname?.toLowerCase().endsWith(".xlsx")
          || file.originalname?.toLowerCase().endsWith(".xls");
        if (!EXCEL_MIMES.has(file.mimetype) && !ext) {
          return cb(
            new Error("Solo se permiten archivos Excel (.xlsx, .xls)") as any,
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
      required: ["idInmueble", "archivo"],
      properties: {
        idInmueble: {
          type: "integer",
          example: 1,
          description: "Id del inmueble al que pertenecen los registros",
        },
        archivo: {
          type: "string",
          format: "binary",
          description:
            "Excel con columnas: Boleto, FechaE, FechaP, Total",
        },
      },
    },
  })
  @ApiOperation({
    summary:
      "Importar entradas/salidas desde Excel (cabeceras Boleto, FechaE, FechaP, Total).",
  })
  importar(
    @Req() req: { body: { idInmueble?: string } },
    @UploadedFile() archivo: Express.Multer.File,
  ) {
    const idInmueble = Number(req.body?.idInmueble);
    if (!Number.isInteger(idInmueble) || idInmueble <= 0) {
      throw new BadRequestException(
        "idInmueble es requerido y debe ser un entero positivo.",
      );
    }
    return this.service.importarExcel(idInmueble, archivo);
  }

  @Get("paginated")
  @ApiOperation({
    summary:
      "Listado paginado por idInmueble y rango de fechas (FechaEntrada).",
  })
  async findPaginated(@Query() query: Record<string, unknown>) {
    const dto = plainToInstance(QueryEntradasSalidasPaginatedDto, query, {
      enableImplicitConversion: true,
    });
    const errors = await validate(dto);
    if (errors.length) {
      throw new BadRequestException({
        message: "Validación fallida",
        errors: errors.map((e) => ({
          property: e.property,
          constraints: e.constraints,
        })),
      });
    }
    return this.service.findPaginated(
      dto.idInmueble,
      dto.page,
      dto.limit,
      dto.fechaInicio,
      dto.fechaFin,
    );
  }
}
