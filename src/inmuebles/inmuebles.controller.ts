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
import { CreateInmuebleDto } from "./dto/create-inmueble.dto";
import { InmueblesService } from "./inmuebles.service";
import { parseNestedFormData } from "./utils/form-data-nested";

@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("inmuebles")
export class InmueblesController {
  constructor(private readonly inmueblesService: InmueblesService) {}

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
  @ApiBody({ type: CreateInmuebleDto })
  @ApiOperation({
    summary: "Registrar inmueble (Inmuebles + Servicios + Zonas + Archivos).",
    description:
      "Campos planos: inmueble, idArrendador, lat, lng, direccionFiscal, etc. " +
      "Arrays: servicios[0].*, archivos[0].nombre/archivo, imagenes[0].*, zonas[0].*, etc.",
  })
  async registrar(
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const nested = parseNestedFormData(req.body, files);
    const dto = plainToInstance(CreateInmuebleDto, nested, {
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
    return this.inmueblesService.registrar(dto, idUser);
  }

  @Get("paginated")
  @ApiOperation({
    summary: "Listar inmuebles paginados (con todas sus relaciones).",
  })
  findAllPaginated(
    @Query("page", ParseIntPipe) page: number,
    @Query("limit", ParseIntPipe) limit: number,
  ) {
    return this.inmueblesService.findAllPaginated(page, limit);
  }

  @Get("arrendador/:idArrendador")
  @ApiOperation({
    summary: "Listar inmuebles por idArrendador (con todas sus relaciones).",
  })
  findByIdArrendador(
    @Param("idArrendador", ParseIntPipe) idArrendador: number,
  ) {
    return this.inmueblesService.findByIdArrendador(idArrendador);
  }

  @Get("zonas/:idInmueble")
  @ApiOperation({ summary: "Listar zonas de un inmueble por idInmueble." })
  findZonasByIdInmueble(
    @Param("idInmueble", ParseIntPipe) idInmueble: number,
  ) {
    return this.inmueblesService.findZonasByIdInmueble(idInmueble);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Obtener inmueble por ID (con todas sus relaciones).",
  })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.inmueblesService.findOne(id);
  }
}
