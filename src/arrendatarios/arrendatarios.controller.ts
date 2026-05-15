import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
} from "@nestjs/swagger";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import * as multer from "multer";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { parseNestedFormData } from "src/inmuebles/utils/form-data-nested";
import { RegistrarArrendatarioFormDto } from "./dto/registrar-arrendatario-form.dto";
import { ArrendatariosService } from "./arrendatarios.service";
import { parseTopLevelJsonStrings } from "./utils/parse-top-level-json";

@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("arrendatarios")
export class ArrendatariosController {
  constructor(private readonly arrendatariosService: ArrendatariosService) {}

  @Get("paginated")
  @ApiOperation({
    summary: "Listar arrendatarios paginados (con relaciones).",
  })
  findAllPaginated(
    @Query("page", ParseIntPipe) page: number,
    @Query("limit", ParseIntPipe) limit: number,
  ) {
    return this.arrendatariosService.findAllPaginated(page, limit);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Obtener arrendatario por ID (con relaciones).",
  })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.arrendatariosService.findOne(id);
  }

  @Post()
  @HttpCode(200)
  @UseInterceptors(
    AnyFilesInterceptor({
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
            new Error("Solo se permiten PNG, JPG, JPEG o PDF"),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: RegistrarArrendatarioFormDto })
  @ApiOperation({
    summary:
      "Registrar arrendatario completo (FormData: JSON arrendatario/contrato + arrays con archivos).",
    description:
      "Campos texto: `arrendatario` (JSON con lat, lng, etc.) y opcional `contratoArrendatario` como JSON. " +
      "Arrays: `servicios[i].*`, `servicios[i].archivo`, `archivos[i].nombre`, `archivos[i].archivo`, " +
      "`imagenes[i].*`, `socios[i].nombre`, `socios[i].rfc`, `socios[i].constanciaFiscalArchivo`, etc.",
  })
  async registrar(
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const nested = parseNestedFormData(req.body, files);
    parseTopLevelJsonStrings(nested, [
      "arrendatario",
      "contratoArrendatario",
    ]);

    const dto = plainToInstance(RegistrarArrendatarioFormDto, nested, {
      enableImplicitConversion: true,
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length) {
      throw new BadRequestException({
        message: "Validación fallida",
        errors: errors.map((e) => ({
          property: e.property,
          constraints: e.constraints,
          children: e.children,
        })),
      });
    }

    const idUser = Number(req?.user?.userId || 0);
    return this.arrendatariosService.registrarCompleto(dto, idUser);
  }
}
