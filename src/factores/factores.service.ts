import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BitacoraService } from "src/bitacora/bitacora.service";
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from "src/common/ApiResponse";
import { Factores } from "src/entities/Factores";
import { Repository } from "typeorm";
import { CreateFactorDto } from "./dto/create-factor.dto";
import { UpdateFactorDto } from "./dto/update-factor.dto";

@Injectable()
export class FactoresService {
  constructor(
    @InjectRepository(Factores)
    private readonly factoresRepository: Repository<Factores>,
    private readonly bitacoraLogger: BitacoraService,
  ) {}

  async create(dto: CreateFactorDto, req: any) {
    await this.assertUniqueVariable(dto.variable);

    const row = this.factoresRepository.create({
      variable: dto.variable,
      valor: dto.valor ?? null,
      descripcion: dto.descripcion ?? null,
      esContrato: dto.esContrato ?? null,
      anioInpc: dto.anioInpc ?? null,
      mesInpc: dto.mesInpc ?? null,
    });
    const saved = await this.factoresRepository.save(row);

    await this.logBitacora(
      req,
      "CREATE",
      `Factor creado: ${saved.variable}.`,
      { dto },
    );

    return this.crudSuccess(
      "El factor ha sido creado correctamente.",
      saved,
    );
  }

  async findOne(id: number) {
    const data = await this.factoresRepository.findOne({ where: { id } });
    if (!data) {
      throw new NotFoundException("Factor no encontrado");
    }
    return data;
  }

  async findAllPaginated(
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await this.factoresRepository.findAndCount({
      skip,
      take: safeLimit,
      order: { id: "DESC" },
    });

    return {
      data,
      paginated: {
        total,
        page: safePage,
        lastPage: total === 0 ? 0 : Math.ceil(total / safeLimit),
      },
    };
  }

  async update(id: number, dto: UpdateFactorDto, req: any) {
    const current = await this.findOne(id);

    if (dto.variable && dto.variable !== current.variable) {
      await this.assertUniqueVariable(dto.variable, id);
    }

    await this.factoresRepository.update(id, {
      ...(dto.variable !== undefined && { variable: dto.variable }),
      ...(dto.valor !== undefined && { valor: dto.valor }),
      ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
      ...(dto.esContrato !== undefined && { esContrato: dto.esContrato }),
      ...(dto.anioInpc !== undefined && { anioInpc: dto.anioInpc ?? null }),
      ...(dto.mesInpc !== undefined && { mesInpc: dto.mesInpc ?? null }),
    });

    const updated = await this.findOne(id);

    await this.logBitacora(
      req,
      "UPDATE",
      `Factor actualizado con id: ${id}.`,
      { dto },
    );

    return this.crudSuccess(
      "El factor ha sido actualizado correctamente.",
      updated,
    );
  }

  async desactivar(id: number, req: any) {
    const current = await this.findOne(id);
    await this.factoresRepository.update(id, { estatus: 0 });

    await this.logBitacora(
      req,
      "UPDATE",
      `Factor dado de BAJA con id: ${id}.`,
      { id },
    );

    return this.crudSuccess(
      "El factor ha sido dado de baja correctamente.",
      current,
    );
  }

  async activar(id: number, req: any) {
    const current = await this.findOne(id);

    if (current.variable) {
      await this.assertUniqueVariable(current.variable, id);
    }

    await this.factoresRepository.update(id, { estatus: 1 });

    await this.logBitacora(
      req,
      "UPDATE",
      `Factor dado de ALTA con id: ${id}.`,
      { id },
    );

    return this.crudSuccess(
      "El factor ha sido dado de alta correctamente.",
      current,
    );
  }

  private async assertUniqueVariable(variable: string, excludeId?: number) {
    const qb = this.factoresRepository
      .createQueryBuilder("f")
      .where("LOWER(f.variable) = LOWER(:variable)", { variable })
      .andWhere("f.estatus = 1");

    if (excludeId != null) {
      qb.andWhere("f.id != :excludeId", { excludeId });
    }

    const exist = await qb.getOne();
    if (exist) {
      throw new ConflictException(
        "Ya existe un factor activo con la misma variable",
      );
    }
  }

  private crudSuccess(message: string, saved: Factores): ApiCrudResponse {
    return {
      status: "success",
      message,
      data: {
        id: saved.id,
        nombre: saved.variable ?? "",
      },
    };
  }

  private async logBitacora(
    req: any,
    action: string,
    message: string,
    payload: object,
  ) {
    const idUser = Number(req?.user?.userId || 0);
    await this.bitacoraLogger.logToBitacora(
      "Factores",
      message,
      action,
      payload,
      idUser,
      1,
      EstatusEnumBitcora.SUCCESS,
    );
  }
}
