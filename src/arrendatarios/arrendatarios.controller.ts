import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
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
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { ApiCrudResponse } from "src/common/ApiResponse";
import { MULTIPART_FILE_OPTIONS } from "src/common/multipart-file.config";
import { parseNestedFormData } from "src/inmuebles/utils/form-data-nested";
import { RegistrarArrendatarioFormDto } from "./dto/registrar-arrendatario-form.dto";
import { ActualizarArrendatarioFormDto } from "./dto/actualizar-arrendatario-form.dto";
import { ArrendatariosDashboardService } from "./arrendatarios-dashboard.service";
import { ArrendatariosService } from "./arrendatarios.service";
import { parseTopLevelJsonStrings } from "./utils/parse-top-level-json";

@ApiTags("Arrendatarios")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("arrendatarios")
export class ArrendatariosController {
  constructor(
    private readonly arrendatariosService: ArrendatariosService,
    private readonly arrendatariosDashboardService: ArrendatariosDashboardService,
  ) {}

  @Get("listado")
  @ApiOperation({
    summary: "Listar arrendatarios (sin paginación)",
    description:
      "Rol 1: todos los estatus. Rol > 1: solo estatus = 1, con relaciones.",
  })
  findAllActivos(@Req() req: any) {
    const cliente = Number(req.user?.cliente || 0);
    const rol = Number(req.user?.rol || 0);
    return this.arrendatariosService.findAllActivos(cliente, rol);
  }

  @Get("dashboard/:idArrendatario")
  @ApiOperation({
    summary: "Dashboard del arrendatario por rango de fechas",
    description:
      "Incluye datos del arrendatario, contratos vigentes en el periodo, zonas y locales " +
      "asignados, histórico de renta, renta actual y pagos del arrendatario.",
  })
  @ApiQuery({ name: "fechaInicio", required: true, example: "2026-01-01" })
  @ApiQuery({ name: "fechaFin", required: true, example: "2026-12-31" })
  getDashboard(
    @Param("idArrendatario", ParseIntPipe) idArrendatario: number,
    @Query("fechaInicio") fechaInicio: string,
    @Query("fechaFin") fechaFin: string,
  ) {
    if (!fechaInicio || !fechaFin) {
      throw new BadRequestException(
        "Se requieren fechaInicio y fechaFin (formato YYYY-MM-DD).",
      );
    }

    return this.arrendatariosDashboardService.getDashboard(
      idArrendatario,
      fechaInicio,
      fechaFin,
    );
  }

  @Get("paginated")
  @ApiOperation({
    summary: "Listar arrendatarios paginados (con relaciones).",
  })
  findAllPaginated(
    @Req() req: any,
    @Query("page", ParseIntPipe) page: number,
    @Query("limit", ParseIntPipe) limit: number,
  ) {
    const cliente = Number(req.user?.cliente || 0);
    const rol = Number(req.user?.rol || 0);
    return this.arrendatariosService.findAllPaginated(
      page,
      limit,
      cliente,
      rol,
    );
  }

  @Get("inmueble/:idInmueble")
  @ApiOperation({
    summary:
      "Listar arrendatarios por idInmueble (vía ContratoArrendatarios).",
  })
  findByIdInmueble(
    @Req() req: any,
    @Param("idInmueble", ParseIntPipe) idInmueble: number,
  ) {
    const rol = Number(req.user?.rol || 0);
    return this.arrendatariosService.findByIdInmueble(idInmueble, rol);
  }

  @Get("servicios/:idArrendatario")
  @ApiOperation({
    summary:
      "Listar servicios (ServiciosArrendatarios) de un arrendatario por idArrendatario.",
  })
  findServiciosByIdArrendatario(
    @Req() req: any,
    @Param("idArrendatario", ParseIntPipe) idArrendatario: number,
  ) {
    const rol = Number(req.user?.rol || 0);
    return this.arrendatariosService.findServiciosByIdArrendatario(
      idArrendatario,
      rol,
    );
  }

  @Delete("contratos/:id")
  @HttpCode(200)
  @ApiOperation({
    summary: "Dar de baja un contrato de arrendatario",
    description:
      "Pone Estatus = 0 y FechaBaja en ContratoArrendatarios; da de baja sus ContratoLocales " +
      "y libera locales a Disponible.",
  })
  @ApiParam({ name: "id", description: "ID del ContratoArrendatarios", example: 1 })
  removeContratoArrendatario(@Param("id", ParseIntPipe) id: number) {
    return this.arrendatariosService.removeContratoArrendatario(id);
  }

  @Delete("servicios/:id")
  @HttpCode(200)
  @ApiOperation({
    summary: "Dar de baja un servicio de arrendatario",
    description: "Pone Estatus = 0 en ServiciosArrendatarios.",
  })
  @ApiParam({ name: "id", description: "ID del servicio", example: 1 })
  removeServicioArrendatario(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ApiCrudResponse> {
    return this.arrendatariosService.removeServicioArrendatario(id);
  }

  @Delete("socios/:id")
  @HttpCode(200)
  @ApiOperation({
    summary: "Dar de baja un socio de arrendatario",
    description: "Pone Estatus = 0 en SociosArrendatarios.",
  })
  @ApiParam({ name: "id", description: "ID del socio", example: 1 })
  removeSocioArrendatario(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ApiCrudResponse> {
    return this.arrendatariosService.removeSocioArrendatario(id);
  }

  @Delete("archivos/:id")
  @HttpCode(200)
  @ApiOperation({
    summary: "Dar de baja un archivo de arrendatario",
    description: "Pone Estatus = 0 en ArchivosArrendatarios.",
  })
  @ApiParam({ name: "id", description: "ID del archivo", example: 1 })
  removeArchivoArrendatario(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ApiCrudResponse> {
    return this.arrendatariosService.removeArchivoArrendatario(id);
  }

  @Delete(":id")
  @HttpCode(200)
  @ApiOperation({
    summary: "Dar de baja un arrendatario (soft-delete)",
    description:
      "Pone Estatus = 0 en Arrendatarios y en dependencias con IdArrendatario " +
      "(ServiciosArrendatarios, SociosArrendatarios, ArchivosArrendatarios, " +
      "ContratoArrendatarios + ContratoLocales/locales, Estacionamientos, PagosArrendatarios).",
  })
  @ApiParam({ name: "id", description: "ID del arrendatario", example: 1 })
  removeArrendatario(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ApiCrudResponse> {
    return this.arrendatariosService.removeArrendatario(id);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Obtener arrendatario por ID (con relaciones).",
  })
  findOne(@Req() req: any, @Param("id", ParseIntPipe) id: number) {
    const rol = Number(req.user?.rol || 0);
    return this.arrendatariosService.findOne(id, rol);
  }

  @Put(":id")
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor(MULTIPART_FILE_OPTIONS as any))
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: ActualizarArrendatarioFormDto })
  @ApiOperation({
    summary:
      "Actualizar arrendatario completo (mismo FormData que registro).",
    description:
      "Opcional `arrendatario` (JSON) para campos del arrendatario. " +
      "`contratos[i]` con `id` actualiza; sin `id` crea contrato nuevo. " +
      "servicios[i].id actualiza; sin id crea. archivos[i].id e imagenes[i].id actualizan; sin id crean. socios[i].id actualiza; sin id crea.",
  })
  async actualizar(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const nested = parseNestedFormData(req.body, req.files);
    parseTopLevelJsonStrings(nested, [
      "arrendatario",
      "contratos",
    ]);

    const dto = plainToInstance(ActualizarArrendatarioFormDto, nested, {
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
    return this.arrendatariosService.actualizarCompleto(id, dto, idUser);
  }

  @Post()
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor(MULTIPART_FILE_OPTIONS as any))
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: RegistrarArrendatarioFormDto })
  @ApiOperation({
    summary:
      "Registrar arrendatario completo (FormData: JSON arrendatario/contrato + arrays con archivos).",
    description:
      "Campos texto: `arrendatario` (JSON con lat, lng, etc.) y opcional `contratos` como JSON array. " +
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
      "contratos",
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
