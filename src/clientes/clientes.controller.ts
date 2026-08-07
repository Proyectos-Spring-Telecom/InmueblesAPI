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
} from "@nestjs/common";
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import * as multer from "multer";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { ApiCrudResponse, ApiResponseCommon } from "src/common/ApiResponse";
import { parseNestedFormData } from "src/inmuebles/utils/form-data-nested";
import { ClientesService } from "./clientes.service";
import { CreateClienteDto } from "./dto/create-cliente.dto";
import { UpdateClienteDto } from "./dto/update-cliente.dto";
import { UpdateClienteEstatusDto } from "./dto/update-cliente-estatus.dto";

const clienteMultipartOptions = {
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

@ApiTags("Clientes")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("clientes")
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor(clienteMultipartOptions as any))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    type: CreateClienteDto,
    description: "Datos del cliente con archivos opcionales.",
  })
  @ApiOperation({ summary: "Crear cliente" })
  async createCliente(@Req() req: any): Promise<ApiCrudResponse> {
    const nested = parseNestedFormData(req.body, req.files);
    const dto = plainToInstance(CreateClienteDto, nested, {
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
    return this.clientesService.createCliente(dto, idUser);
  }

  @Get("list")
  @ApiOperation({ summary: "Listado de clientes activos (sin paginación)" })
  async getAllListClientes(@Req() req): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.clientesService.getAllListClientes(+idUser, +cliente, +rol);
  }

  @Get(":page/:limit")
  @ApiOperation({ summary: "Listado paginado de clientes" })
  getAllClientes(
    @Param("page", ParseIntPipe) page: number,
    @Param("limit", ParseIntPipe) limit: number,
    @Req() req,
  ): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.clientesService.getAllClientes(
      +idUser,
      +cliente,
      +rol,
      page,
      limit,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener cliente por ID" })
  getOneCliente(@Param("id") id: string, @Req() req) {
    const rol = Number(req.user?.rol || 0);
    return this.clientesService.getOneCliente(+id, rol);
  }

  @Patch("estatus/:id")
  @ApiOperation({ summary: "Cambiar estatus del cliente" })
  updateEstatusCliente(
    @Param("id") id: string,
    @Req() req,
    @Body() updateClienteEstatusDto: UpdateClienteEstatusDto,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.clientesService.updateClienteStatus(
      +id,
      idUser,
      updateClienteEstatusDto,
    );
  }

  @Put(":id")
  @UseInterceptors(AnyFilesInterceptor(clienteMultipartOptions as any))
  @ApiOperation({ summary: "Actualizar cliente" })
  @ApiParam({ name: "id", description: "ID del cliente", example: 1 })
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: UpdateClienteDto })
  async updateCliente(
    @Param("id") id: string,
    @Req() req: any,
  ): Promise<ApiCrudResponse> {
    const nested = parseNestedFormData(req.body, req.files);
    const dto = plainToInstance(UpdateClienteDto, nested, {
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
    return this.clientesService.updateCliente(+id, idUser, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Desactivar cliente (estatus 0)" })
  async removeCliente(
    @Param("id") id: string,
    @Req() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.clientesService.removeCliente(+id, idUser);
  }
}
