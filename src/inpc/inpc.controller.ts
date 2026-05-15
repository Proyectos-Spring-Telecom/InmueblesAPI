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
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/guard/jwt-auth.guard";
import { CreateInpcDto } from "./dto/create-inpc.dto";
import { UpdateInpcDto } from "./dto/update-inpc.dto";
import { InpcService } from "./inpc.service";

@ApiTags("INPC")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@Controller("inpc")
export class InpcController {
  constructor(private readonly inpcService: InpcService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: "Registrar INPC" })
  create(@Body() dto: CreateInpcDto, @Req() req: any) {
    return this.inpcService.create(dto, req);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Editar INPC" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateInpcDto,
    @Req() req: any,
  ) {
    return this.inpcService.update(id, dto, req);
  }

  @Patch("desactivar/:id")
  @ApiOperation({ summary: "Dar de baja (estatus 0) un registro INPC" })
  desactivar(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    return this.inpcService.desactivar(id, req);
  }

  @Patch("activar/:id")
  @ApiOperation({ summary: "Dar de alta (estatus 1) un registro INPC" })
  activar(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    return this.inpcService.activar(id, req);
  }

  @Get("paginated")
  @ApiOperation({ summary: "Listar INPC paginado" })
  findAllPaginated(
    @Query("page", ParseIntPipe) page: number,
    @Query("limit", ParseIntPipe) limit: number,
  ) {
    return this.inpcService.findAllPaginated(page, limit);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener INPC por ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.inpcService.findOne(id);
  }
}
