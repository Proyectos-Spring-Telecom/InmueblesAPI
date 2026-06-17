import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ApiResponseCommon } from "src/common/ApiResponse";
import { parseRangoFechas } from "src/common/pago-mensual.utils";
import { CatMetodosPago } from "src/entities/CatMetodosPago";
import { Inmuebles } from "src/entities/Inmuebles";
import { Pago } from "src/entities/Pago";
import { ServiciosInmuebles } from "src/entities/ServiciosInmuebles";
import { S3Service } from "src/s3/s3.service";
import { Repository } from "typeorm";
import { PagoEstatus } from "src/common/pago-estatus.enum";
import { CreatePagoDto } from "./dto/create-pago.dto";

const FOLDER_COMPROBANTE = "ComprobantesPagoInmuebles";
const ID_MODULE = 1;

const FULL_RELATIONS = [
  "inmueble",
  "servicioInmueble",
  "servicioInmueble.tipoServicio",
  "metodoPago",
];

export interface PagoFilters {
  fechaInicio: string;
  fechaFin: string;
  idInmueble?: number;
}

@Injectable()
export class PagoService {
  constructor(
    @InjectRepository(Pago)
    private readonly pagoRepository: Repository<Pago>,
    @InjectRepository(Inmuebles)
    private readonly inmueblesRepository: Repository<Inmuebles>,
    @InjectRepository(ServiciosInmuebles)
    private readonly serviciosInmueblesRepository: Repository<ServiciosInmuebles>,
    @InjectRepository(CatMetodosPago)
    private readonly catMetodosPagoRepository: Repository<CatMetodosPago>,
    private readonly s3Service: S3Service,
  ) {}

  async registrar(
    dto: CreatePagoDto,
    comprobante: Express.Multer.File | undefined,
    idUser: number,
  ) {
    if (!comprobante) {
      throw new BadRequestException("ComprobantePagoArchivo es requerido");
    }

    const inmueble = await this.inmueblesRepository.findOne({
      where: { id: dto.idInmueble },
    });
    if (!inmueble) {
      throw new NotFoundException(
        `Inmueble con id ${dto.idInmueble} no encontrado`,
      );
    }

    if (dto.idServicioInmueble != null) {
      const servicio = await this.serviciosInmueblesRepository.findOne({
        where: { id: dto.idServicioInmueble },
      });
      if (!servicio) {
        throw new NotFoundException(
          `Servicio de inmueble con id ${dto.idServicioInmueble} no encontrado`,
        );
      }
    }

    if (dto.idMetodoPago != null) {
      const metodo = await this.catMetodosPagoRepository.findOne({
        where: { id: dto.idMetodoPago },
      });
      if (!metodo) {
        throw new NotFoundException(
          `Método de pago con id ${dto.idMetodoPago} no encontrado`,
        );
      }
    }

    const upload = await this.s3Service.uploadFile(
      comprobante,
      FOLDER_COMPROBANTE,
      idUser,
      ID_MODULE,
    );

    const row = this.pagoRepository.create({
      idInmueble: dto.idInmueble,
      idServicioInmueble: dto.idServicioInmueble ?? null,
      concepto: dto.concepto ?? null,
      fechaPago: new Date(dto.fechaPago),
      monto: String(dto.monto),
      idMetodoPago: dto.idMetodoPago ?? null,
      estatus: dto.estatus ?? PagoEstatus.Pagado,
      comprobantePago: upload.url,
    });

    const saved = await this.pagoRepository.save(row);
    return this.findOne(Number(saved.id));
  }

  async findOne(id: number) {
    const data = await this.pagoRepository.findOne({
      where: { id },
      relations: FULL_RELATIONS,
    });
    if (!data) {
      throw new NotFoundException(`Pago con id ${id} no encontrado`);
    }
    return data;
  }

  async updateEstatus(id: number, estatus: PagoEstatus) {
    const pago = await this.pagoRepository.findOne({
      where: { id },
      select: ["id"],
    });
    if (!pago) {
      throw new NotFoundException(`Pago con id ${id} no encontrado`);
    }

    await this.pagoRepository.update(id, { estatus });

    return {
      status: "success",
      message: "Estatus del pago actualizado correctamente.",
      data: await this.findOne(id),
    };
  }

  async findAllPaginated(
    page: number,
    limit: number,
    filters: PagoFilters,
  ): Promise<ApiResponseCommon> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const skip = (safePage - 1) * safeLimit;
    const { inicio, fin } = parseRangoFechas(
      filters.fechaInicio,
      filters.fechaFin,
    );

    const qb = this.pagoRepository
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.inmueble", "inmueble")
      .leftJoinAndSelect("p.servicioInmueble", "servicioInmueble")
      .leftJoinAndSelect("servicioInmueble.tipoServicio", "tipoServicio")
      .leftJoinAndSelect("p.metodoPago", "metodoPago")
      .where("p.fechaPago >= :inicio", { inicio })
      .andWhere("p.fechaPago <= :fin", { fin });

    if (filters.idInmueble != null) {
      qb.andWhere("p.idInmueble = :idInmueble", {
        idInmueble: filters.idInmueble,
      });
    }

    const total = await qb.getCount();

    const data = await qb
      .orderBy("p.fechaPago", "DESC")
      .addOrderBy("p.id", "DESC")
      .skip(skip)
      .take(safeLimit)
      .getMany();

    return {
      data,
      paginated: {
        total,
        page: safePage,
        lastPage: total === 0 ? 0 : Math.ceil(total / safeLimit),
      },
    };
  }

  assertOptionalInt(value: string | undefined, field: string): number | undefined {
    if (value === undefined || value === "") return undefined;
    const n = Number(value);
    if (!Number.isInteger(n)) {
      throw new BadRequestException(`${field} debe ser un entero válido.`);
    }
    return n;
  }
}
