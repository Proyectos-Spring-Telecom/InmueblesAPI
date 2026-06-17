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
import { Formulas } from "src/entities/Formulas";
import { Repository } from "typeorm";
import { CreateFormulaDto } from "./dto/create-formula.dto";
import { UpdateFormulaDto } from "./dto/update-formula.dto";

@Injectable()
export class FormulasService {
  constructor(
    @InjectRepository(Formulas)
    private readonly formulasRepository: Repository<Formulas>,
    private readonly bitacoraLogger: BitacoraService,
  ) { }

  async create(dto: CreateFormulaDto, req: any) {
    await this.assertUniqueNombre(dto.nombre);

    const row = this.formulasRepository.create({
      nombre: dto.nombre,
      formula: dto.formula ?? null,
      descripcion: dto.descripcion ?? null,
      tipoResultado: dto.tipoResultado ?? "MONTO",
    });
    const saved = await this.formulasRepository.save(row);

    await this.logBitacora(
      req,
      "CREATE",
      `Fórmula creada: ${saved.nombre}.`,
      { dto },
    );

    return this.crudSuccess(
      "La fórmula ha sido creada correctamente.",
      saved,
    );
  }

  async findOne(id: number) {
    const data = await this.formulasRepository.findOne({ where: { id } });
    if (!data) {
      throw new NotFoundException("Fórmula no encontrada");
    }
    return data;
  }

  async findAllActivos(): Promise<{ data: Formulas[] }> {
    const data = await this.formulasRepository.find({
      where: { estatus: 1 },
      order: { id: "DESC" },
    });

    return { data };
  }

  async findAllPaginated(
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await this.formulasRepository.findAndCount({
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

  async update(id: number, dto: UpdateFormulaDto, req: any) {
    const current = await this.findOne(id);

    if (dto.nombre && dto.nombre !== current.nombre) {
      await this.assertUniqueNombre(dto.nombre, id);
    }

    await this.formulasRepository.update(id, {
      ...(dto.nombre !== undefined && { nombre: dto.nombre }),
      ...(dto.formula !== undefined && { formula: dto.formula }),
      ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
      ...(dto.tipoResultado !== undefined && {
        tipoResultado: dto.tipoResultado,
      }),
    });

    const updated = await this.findOne(id);

    await this.logBitacora(
      req,
      "UPDATE",
      `Fórmula actualizada con id: ${id}.`,
      { dto },
    );

    return this.crudSuccess(
      "La fórmula ha sido actualizada correctamente.",
      updated,
    );
  }

  async desactivar(id: number, req: any) {
    const current = await this.findOne(id);
    await this.formulasRepository.update(id, { estatus: 0 });

    await this.logBitacora(
      req,
      "UPDATE",
      `Fórmula dada de BAJA con id: ${id}.`,
      { id },
    );

    return this.crudSuccess(
      "La fórmula ha sido dada de baja correctamente.",
      current,
    );
  }

  async activar(id: number, req: any) {
    const current = await this.findOne(id);

    if (current.nombre) {
      await this.assertUniqueNombre(current.nombre, id);
    }

    await this.formulasRepository.update(id, { estatus: 1 });

    await this.logBitacora(
      req,
      "UPDATE",
      `Fórmula dada de ALTA con id: ${id}.`,
      { id },
    );

    return this.crudSuccess(
      "La fórmula ha sido dada de alta correctamente.",
      current,
    );
  }

  private async assertUniqueNombre(nombre: string, excludeId?: number) {
    const qb = this.formulasRepository
      .createQueryBuilder("f")
      .where("LOWER(f.nombre) = LOWER(:nombre)", { nombre })
      .andWhere("f.estatus = 1");

    if (excludeId != null) {
      qb.andWhere("f.id != :excludeId", { excludeId });
    }

    const exist = await qb.getOne();
    if (exist) {
      throw new ConflictException(
        "Ya existe una fórmula activa con el mismo nombre",
      );
    }
  }

  private crudSuccess(message: string, saved: Formulas): ApiCrudResponse {
    return {
      status: "success",
      message,
      data: {
        id: saved.id,
        nombre: saved.nombre ?? "",
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
      "Formulas",
      message,
      action,
      payload,
      idUser,
      1,
      EstatusEnumBitcora.SUCCESS,
    );
  }
}
