import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ApiResponseCommon } from "src/common/ApiResponse";
import { EntradasSalidasEstacionamiento } from "src/entities/EntradasSalidasEstacionamiento";
import { Inmuebles } from "src/entities/Inmuebles";
import {
  Between,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from "typeorm";
import { parseEntradasSalidasExcel } from "./utils/parse-excel-entradas";

const CHUNK_SIZE = 500;

@Injectable()
export class EntradasSalidasEstacionamientoService {
  constructor(
    @InjectRepository(EntradasSalidasEstacionamiento)
    private readonly repository: Repository<EntradasSalidasEstacionamiento>,
    @InjectRepository(Inmuebles)
    private readonly inmueblesRepository: Repository<Inmuebles>,
  ) {}

  async importarExcel(
    idInmueble: number,
    archivo: Express.Multer.File | undefined,
  ) {
    if (!archivo?.buffer?.length) {
      throw new BadRequestException("El archivo Excel es requerido.");
    }

    await this.assertInmuebleExists(idInmueble);

    const { rows, advertencias, filasOmitidas } = parseEntradasSalidasExcel(
      archivo.buffer,
    );

    const entities = rows.map((r) =>
      this.repository.create({
        idInmueble,
        boleto: r.boleto,
        fechaEntrada: r.fechaEntrada,
        fechaSalida: r.fechaSalida,
        total: r.total,
      }),
    );

    let insertados = 0;
    for (let i = 0; i < entities.length; i += CHUNK_SIZE) {
      const chunk = entities.slice(i, i + CHUNK_SIZE);
      const result = await this.repository.insert(chunk);
      insertados += result.identifiers.length;
    }

    return {
      status: "success",
      message: `${insertados} registro(s) importado(s) correctamente.`,
      data: {
        idInmueble,
        insertados,
        filasOmitidas,
        advertencias,
      },
    };
  }

  async findPaginated(
    idInmueble: number,
    page: number,
    limit: number,
    fechaInicio?: string,
    fechaFin?: string,
  ): Promise<ApiResponseCommon> {
    await this.assertInmuebleExists(idInmueble);

    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const skip = (safePage - 1) * safeLimit;

    const where: FindOptionsWhere<EntradasSalidasEstacionamiento> = {
      idInmueble,
    };

    if (fechaInicio && fechaFin) {
      where.fechaEntrada = Between(
        new Date(`${fechaInicio}T00:00:00`),
        new Date(`${fechaFin}T23:59:59.999`),
      );
    } else if (fechaInicio) {
      where.fechaEntrada = MoreThanOrEqual(new Date(`${fechaInicio}T00:00:00`));
    } else if (fechaFin) {
      where.fechaEntrada = LessThanOrEqual(new Date(`${fechaFin}T23:59:59.999`));
    }

    const [data, total] = await this.repository.findAndCount({
      where,
      order: { fechaEntrada: "DESC", id: "DESC" },
      skip,
      take: safeLimit,
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

  private async assertInmuebleExists(idInmueble: number): Promise<void> {
    const inmueble = await this.inmueblesRepository.findOne({
      where: { id: idInmueble },
      select: ["id"],
    });
    if (!inmueble) {
      throw new NotFoundException(
        `Inmueble con id ${idInmueble} no encontrado.`,
      );
    }
  }
}
