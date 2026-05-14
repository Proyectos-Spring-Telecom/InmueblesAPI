import {
  BadRequestException,
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
import { CatServicios } from "src/entities/CatServicios";
import { Raw, Repository } from "typeorm";
import { CreateCatServicioDto } from "./dto/create-cat-servicio.dto";
import { UpdateCatServicioDto } from "./dto/update-cat-servicio.dto";

@Injectable()
export class CatServiciosService {
  constructor(
    @InjectRepository(CatServicios)
    private readonly catServiciosRepository: Repository<CatServicios>,
    private readonly bitacoraLogger: BitacoraService,
  ) {}

  async create(dto: CreateCatServicioDto, req: any) {
    try {
      const exist = await this.catServiciosRepository.findOne({
        where: {
          nombre: Raw((alias) => `LOWER(${alias}) = LOWER(:nombre)`, {
            nombre: dto.nombre,
          }),
          estatus: 1,
        } as any,
      });
      if (exist) {
        throw new ConflictException("Ya existe un servicio con el mismo nombre");
      }

      const fhRegistro = new Date().toISOString();
      const row = this.catServiciosRepository.create({
        nombre: dto.nombre,
        estatus: 1,
        fhRegistro,
      });
      const saved = await this.catServiciosRepository.save(row);

      const idUser = Number(req?.user?.userId || 0);
      await this.bitacoraLogger.logToBitacora(
        "CatServicios",
        `Servicio creado correctamente con nombre: ${saved.nombre}.`,
        "CREATE",
        { dto },
        idUser,
        1,
        EstatusEnumBitcora.SUCCESS,
      );

      const result: ApiCrudResponse = {
        status: "success",
        message: "El servicio ha sido creado correctamente.",
        data: { id: saved.id, nombre: saved.nombre ?? "" },
      };
      return result;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async findOne(id: number) {
    try {
      const data = await this.catServiciosRepository.findOne({
        where: { id: id } as any,
      });
      if (!data) throw new NotFoundException("Servicio no encontrado");
      return data;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(error);
    }
  }

  async findAllPaginated(page: number, limit: number) {
    try {
      const skip = (page - 1) * limit;
      const [data, total] = await this.catServiciosRepository.findAndCount({
        skip,
        take: limit,
        order: { id: "DESC" } as any,
      });
      const result: ApiResponseCommon = {
        data,
        paginated: {
          total,
          page,
          lastPage: Math.ceil(total / limit),
        },
      };
      return result;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async update(id: number, dto: UpdateCatServicioDto, req: any) {
    try {
      const current = await this.catServiciosRepository.findOne({
        where: { id } as any,
      });
      if (!current) throw new NotFoundException("Servicio no encontrado");

      if (dto.nombre && dto.nombre !== current.nombre) {
        const exist = await this.catServiciosRepository.findOne({
          where: {
            nombre: Raw((alias) => `LOWER(${alias}) = LOWER(:nombre)`, {
              nombre: dto.nombre,
            }),
            estatus: 1,
            id: Raw((alias) => `${alias} != :id`, { id }),
          } as any,
        });
        if (exist) {
          throw new ConflictException(
            "Ya existe un servicio con el mismo nombre",
          );
        }
      }

      await this.catServiciosRepository.update(id, dto as any);
      const updated = await this.catServiciosRepository.findOne({
        where: { id } as any,
      });

      const idUser = Number(req?.user?.userId || 0);
      await this.bitacoraLogger.logToBitacora(
        "CatServicios",
        `Servicio actualizado correctamente con id: ${id}.`,
        "UPDATE",
        { dto },
        idUser,
        1,
        EstatusEnumBitcora.SUCCESS,
      );

      const result: ApiCrudResponse = {
        status: "success",
        message: "El servicio ha sido actualizado correctamente.",
        data: { id: updated?.id ?? id, nombre: updated?.nombre ?? "" },
      };
      return result;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException)
        throw error;
      throw new BadRequestException(error);
    }
  }

  async desactivar(id: number, req: any) {
    try {
      const current = await this.catServiciosRepository.findOne({
        where: { id } as any,
      });
      if (!current) throw new NotFoundException("Servicio no encontrado");

      await this.catServiciosRepository.update(id, { estatus: 0 } as any);

      const idUser = Number(req?.user?.userId || 0);
      await this.bitacoraLogger.logToBitacora(
        "CatServicios",
        `Servicio desactivado correctamente con id: ${id}.`,
        "UPDATE",
        { id },
        idUser,
        1,
        EstatusEnumBitcora.SUCCESS,
      );

      const result: ApiCrudResponse = {
        status: "success",
        message: "El servicio ha sido desactivado correctamente.",
        data: { id: current.id, nombre: current.nombre ?? "" },
      };
      return result;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(error);
    }
  }

  async activar(id: number, req: any) {
    try {
      const current = await this.catServiciosRepository.findOne({
        where: { id } as any,
      });
      if (!current) throw new NotFoundException("Servicio no encontrado");

      await this.catServiciosRepository.update(id, { estatus: 1 } as any);

      const idUser = Number(req?.user?.userId || 0);
      await this.bitacoraLogger.logToBitacora(
        "CatServicios",
        `Servicio activado correctamente con id: ${id}.`,
        "UPDATE",
        { id },
        idUser,
        1,
        EstatusEnumBitcora.SUCCESS,
      );

      const result: ApiCrudResponse = {
        status: "success",
        message: "El servicio ha sido activado correctamente.",
        data: { id: current.id, nombre: current.nombre ?? "" },
      };
      return result;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(error);
    }
  }
}

