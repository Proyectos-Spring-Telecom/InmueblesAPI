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
import { CatMetodosPago } from "src/entities/CatMetodosPago";
import { Repository } from "typeorm";
import { CreateCatMetodoPagoDto } from "./dto/create-cat-metodo-pago.dto";
import { UpdateCatMetodoPagoDto } from "./dto/update-cat-metodo-pago.dto";

@Injectable()
export class CatMetodosPagoService {
  constructor(
    @InjectRepository(CatMetodosPago)
    private readonly catMetodosPagoRepository: Repository<CatMetodosPago>,
    private readonly bitacoraLogger: BitacoraService,
  ) {}

  async create(dto: CreateCatMetodoPagoDto, req: any) {
    await this.assertUniqueNombre(dto.nombre);

    const row = this.catMetodosPagoRepository.create({
      nombre: dto.nombre,
    });
    const saved = await this.catMetodosPagoRepository.save(row);

    await this.logBitacora(
      req,
      "CREATE",
      `Método de pago creado: ${saved.nombre}.`,
      { dto },
    );

    return this.crudSuccess(
      "El método de pago ha sido creado correctamente.",
      saved,
    );
  }

  async findOne(id: number) {
    const data = await this.catMetodosPagoRepository.findOne({ where: { id } });
    if (!data) {
      throw new NotFoundException("Método de pago no encontrado");
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

    const [data, total] = await this.catMetodosPagoRepository.findAndCount({
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

  async update(id: number, dto: UpdateCatMetodoPagoDto, req: any) {
    const current = await this.findOne(id);

    if (dto.nombre && dto.nombre !== current.nombre) {
      await this.assertUniqueNombre(dto.nombre, id);
    }

    if (dto.nombre !== undefined) {
      await this.catMetodosPagoRepository.update(id, { nombre: dto.nombre });
    }

    const updated = await this.findOne(id);

    await this.logBitacora(
      req,
      "UPDATE",
      `Método de pago actualizado con id: ${id}.`,
      { dto },
    );

    return this.crudSuccess(
      "El método de pago ha sido actualizado correctamente.",
      updated,
    );
  }

  async desactivar(id: number, req: any) {
    const current = await this.findOne(id);
    await this.catMetodosPagoRepository.update(id, { estatus: 0 });

    await this.logBitacora(
      req,
      "UPDATE",
      `Método de pago dado de BAJA con id: ${id}.`,
      { id },
    );

    return this.crudSuccess(
      "El método de pago ha sido dado de baja correctamente.",
      current,
    );
  }

  async activar(id: number, req: any) {
    const current = await this.findOne(id);

    if (current.nombre) {
      await this.assertUniqueNombre(current.nombre, id);
    }

    await this.catMetodosPagoRepository.update(id, { estatus: 1 });

    await this.logBitacora(
      req,
      "UPDATE",
      `Método de pago dado de ALTA con id: ${id}.`,
      { id },
    );

    return this.crudSuccess(
      "El método de pago ha sido dado de alta correctamente.",
      current,
    );
  }

  private async assertUniqueNombre(nombre: string, excludeId?: number) {
    const qb = this.catMetodosPagoRepository
      .createQueryBuilder("m")
      .where("LOWER(m.nombre) = LOWER(:nombre)", { nombre })
      .andWhere("m.estatus = 1");

    if (excludeId != null) {
      qb.andWhere("m.id != :excludeId", { excludeId });
    }

    const exist = await qb.getOne();
    if (exist) {
      throw new ConflictException(
        "Ya existe un método de pago activo con el mismo nombre",
      );
    }
  }

  private crudSuccess(
    message: string,
    saved: CatMetodosPago,
  ): ApiCrudResponse {
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
      "CatMetodosPago",
      message,
      action,
      payload,
      idUser,
      1,
      EstatusEnumBitcora.SUCCESS,
    );
  }
}
