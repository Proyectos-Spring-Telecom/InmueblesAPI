import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Body,
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
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { MULTIPART_FILE_OPTIONS } from "src/common/multipart-file.config";
import { CreateInmuebleDto } from "./dto/create-inmueble.dto";
import { UpdateInmuebleDto } from "./dto/update-inmueble.dto";
import { UpdateMapaInmuebleDto } from "./dto/update-mapa-inmueble.dto";
import { UpdateLocalEstatusDto } from "./dto/update-local-estatus.dto";
import { InmueblesService } from "./inmuebles.service";
import { parseNestedFormData } from "./utils/form-data-nested";

@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("inmuebles")
export class InmueblesController {
  constructor(private readonly inmueblesService: InmueblesService) {}

  @Put(":id")
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor(MULTIPART_FILE_OPTIONS as any))
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: UpdateInmuebleDto })
  @ApiOperation({
    summary:
      "Actualizar inmueble completo (mismo FormData que registro; arrays hacen append).",
    description:
      "Campos planos opcionales del inmueble. Arrays servicios/zonas/archivos/imagenes agregan registros nuevos.",
  })
  async actualizar(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    const nested = parseNestedFormData(req.body, req.files);
    const dto = plainToInstance(UpdateInmuebleDto, nested, {
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
    return this.inmueblesService.actualizar(id, dto, idUser);
  }

  @Post()
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor(MULTIPART_FILE_OPTIONS as any))
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: CreateInmuebleDto })
  @ApiOperation({
    summary: "Registrar inmueble (Inmuebles + Servicios + Zonas + Archivos).",
    description:
      "Campos planos: inmueble, idArrendador, lat, lng, direccionFiscal, etc. " +
      "Arrays: servicios[0].*, archivos[0].nombre/archivo, imagenes[0].*, zonas[0].*, zonas[0].locales[0].*, etc.",
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
  @ApiOperation({
    summary: "Listar zonas de un inmueble por idInmueble (con locales).",
  })
  findZonasByIdInmueble(
    @Param("idInmueble", ParseIntPipe) idInmueble: number,
  ) {
    return this.inmueblesService.findZonasByIdInmueble(idInmueble);
  }

  @Get("locales-libres/:idInmueble")
  @ApiOperation({
    summary:
      "Listar locales disponibles (LocalesEstatus.Disponible) de un inmueble por idInmueble.",
  })
  findLocalesLibresByIdInmueble(
    @Param("idInmueble", ParseIntPipe) idInmueble: number,
  ) {
    return this.inmueblesService.findLocalesLibresByIdInmueble(idInmueble);
  }

  @Get("locales/:idInmueble")
  @ApiOperation({
    summary:
      "Listar locales (LocalesZonaInmueble) de un inmueble por idInmueble.",
  })
  findLocalesByIdInmueble(
    @Param("idInmueble", ParseIntPipe) idInmueble: number,
  ) {
    return this.inmueblesService.findLocalesByIdInmueble(idInmueble);
  }

  @Patch("locales/:idLocal/estatus")
  @HttpCode(200)
  @ApiOperation({ summary: "Actualizar estatus de un local por idLocal." })
  @ApiBody({ type: UpdateLocalEstatusDto })
  updateLocalEstatus(
    @Param("idLocal", ParseIntPipe) idLocal: number,
    @Body() dto: UpdateLocalEstatusDto,
  ) {
    return this.inmueblesService.updateLocalEstatus(idLocal, dto.estatus);
  }

  @Patch("mapa/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Actualizar solo MapaInmueble (JSON) del inmueble." })
  @ApiBody({ type: UpdateMapaInmuebleDto })
  async updateMapaInmueble(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMapaInmuebleDto,
  ) {
    return this.inmueblesService.updateMapaInmueble(id, dto.mapaInmueble);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Obtener inmueble por ID (con todas sus relaciones).",
  })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.inmueblesService.findOne(id);
  }
}
