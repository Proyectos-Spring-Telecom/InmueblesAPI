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
  Put,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from "@nestjs/common";
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import * as multer from "multer";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ArrendadoresService } from "./arrendadores.service";
import { CreateArrendadorDto } from "./dto/create-arrendador.dto";
import { ApiCrudResponse, ApiResponseCommon } from "src/common/ApiResponse";
import { UpdateArrendadorEstatusDto } from "./dto/update-arrendador-estatus.dto";
import { UpdateArrendadorDto } from "./dto/update-arrendador.dto";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiParam,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { parseNestedFormData } from "src/inmuebles/utils/form-data-nested";

const arrendadorMultipartOptions = {
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Solo se permiten PNG, JPG, JPEG o PDF"), false);
    }
    cb(null, true);
  },
};

@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("arrendadores")
export class ArrendadoresController {
  constructor(private readonly clientesService: ArrendadoresService) {}

  @Post()
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor(arrendadorMultipartOptions as any))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    type: CreateArrendadorDto,
    description:
      "Datos del cliente con archivos opcionales y array socios[i].*",
  })
  async createArrendador(@Req() req: any): Promise<ApiCrudResponse> {
    const nested = parseNestedFormData(req.body, req.files);
    const dto = plainToInstance(CreateArrendadorDto, nested, {
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
    const idUser = req.user.userId;
    const cliente = Number(req.user?.cliente || 0);
    const rol = Number(req.user?.rol || 0);
    return this.clientesService.createArrendador(dto, idUser, cliente, rol);
  }

  @Get("list")
  async getAllListArrendadores(@Req() req): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.clientesService.getAllListArrendadores(+idUser, +cliente, +rol);
  }

  @Get(":page/:limit")
  getAllArrendadores(
    @Param("page", ParseIntPipe) page: number,
    @Param("limit", ParseIntPipe) limit: number,
    @Req() req,
  ): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.clientesService.getAllArrendadores(
      +idUser,
      +cliente,
      +rol,
      page,
      limit,
    );
  }

  @Get(":id")
  getOneArrendador(@Param("id") id: string) {
    return this.clientesService.getOneArrendador(+id);
  }

  @Patch("estatus/:id")
  updateEstatusArrendadores(
    @Param("id") id: string,
    @Req() req,
    @Body() updateArrendadorEstatusDto: UpdateArrendadorEstatusDto,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.clientesService.updateArrendadorStatus(
      +id,
      idUser,
      updateArrendadorEstatusDto,
    );
  }

  @Put(":id")
  @UseInterceptors(AnyFilesInterceptor(arrendadorMultipartOptions as any))
  @ApiOperation({
    summary: "Actualizar información completa del cliente",
    description:
      "Actualiza el cliente. socios[i].id actualiza socio existente; sin id crea uno nuevo. " +
      "Archivos del cliente y documentos de socios se suben a S3.",
  })
  @ApiParam({
    name: "id",
    description: "ID del cliente a actualizar",
    example: 1,
    type: Number,
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    type: UpdateArrendadorDto,
    description:
      "Campos opcionales del cliente, archivos y socios[i].* (con id actualiza, sin id crea).",
  })
  async updateArrendador(
    @Param("id") id: string,
    @Req() req: any,
  ): Promise<ApiCrudResponse> {
    const nested = parseNestedFormData(req.body, req.files);
    const dto = plainToInstance(UpdateArrendadorDto, nested, {
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
    const idUser = req.user.userId;
    return this.clientesService.updateArrendador(+id, idUser, dto);
  }

  @Delete("socios/:idSocioArrendador")
  @ApiOperation({
    summary: "Eliminar (desactivar) socio arrendador",
    description: "Pone Estatus = 0 en SociosArrendadores por idSocioArrendador.",
  })
  @ApiParam({
    name: "idSocioArrendador",
    description: "ID del socio arrendador",
    example: 1,
    type: Number,
  })
  async removeSocioArrendador(
    @Param("idSocioArrendador", ParseIntPipe) idSocioArrendador: number,
    @Req() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.clientesService.removeSocioArrendador(idSocioArrendador, idUser);
  }

  @Delete(":id")
  async removeArrendadors(
    @Param("id") id: string,
    @Req() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.clientesService.removeArrendador(+id, idUser);
  }
}
