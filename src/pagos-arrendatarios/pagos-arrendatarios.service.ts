import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ApiResponseCommon } from "src/common/ApiResponse";
import { PagoEstatus } from "src/common/pago-estatus.enum";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { CatMetodosPago } from "src/entities/CatMetodosPago";
import { PagosArrendatarios } from "src/entities/PagosArrendatarios";
import { ServiciosArrendatarios } from "src/entities/ServiciosArrendatarios";
import { S3Service } from "src/s3/s3.service";
import { In, Repository } from "typeorm";
import { CreatePagosArrendatarioDto } from "./dto/create-pagos-arrendatario.dto";

const FOLDER_COMPROBANTE = "ComprobantesPagoArrendatarios";
const ID_MODULE = 1;

const FULL_RELATIONS = [
  "arrendatario",
  "servicioArrendatario",
  "servicioArrendatario.tipoServicio",
  "metodoPago",
];

@Injectable()
export class PagosArrendatariosService {
  constructor(
    @InjectRepository(PagosArrendatarios)
    private readonly pagosArrendatariosRepository: Repository<PagosArrendatarios>,
    @InjectRepository(Arrendatarios)
    private readonly arrendatariosRepository: Repository<Arrendatarios>,
    @InjectRepository(ServiciosArrendatarios)
    private readonly serviciosArrendatariosRepository: Repository<ServiciosArrendatarios>,
    @InjectRepository(CatMetodosPago)
    private readonly catMetodosPagoRepository: Repository<CatMetodosPago>,
    private readonly s3Service: S3Service,
  ) {}

  async registrar(
    dto: CreatePagosArrendatarioDto,
    comprobante: Express.Multer.File | undefined,
    idUser: number,
  ) {
    if (!comprobante) {
      throw new BadRequestException("ComprobantePagoArchivo es requerido");
    }

    const arrendatario = await this.arrendatariosRepository.findOne({
      where: { id: dto.idArrendatario },
    });
    if (!arrendatario) {
      throw new NotFoundException(
        `Arrendatario con id ${dto.idArrendatario} no encontrado`,
      );
    }

    if (dto.idServicioArrendatario != null) {
      const servicio = await this.serviciosArrendatariosRepository.findOne({
        where: { id: dto.idServicioArrendatario },
      });
      if (!servicio) {
        throw new NotFoundException(
          `Servicio de arrendatario con id ${dto.idServicioArrendatario} no encontrado`,
        );
      }
      if (Number(servicio.idArrendatario) !== dto.idArrendatario) {
        throw new BadRequestException(
          `El servicio ${dto.idServicioArrendatario} no pertenece al arrendatario ${dto.idArrendatario}.`,
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

    const row = this.pagosArrendatariosRepository.create({
      idArrendatario: dto.idArrendatario,
      idServicioArrendatario: dto.idServicioArrendatario ?? null,
      concepto: dto.concepto ?? null,
      fechaPago: new Date(dto.fechaPago),
      monto: String(dto.monto),
      idMetodoPago: dto.idMetodoPago ?? null,
      estatus: dto.estatus ?? PagoEstatus.Pagado,
      comprobantePago: upload.url,
    });

    const saved = await this.pagosArrendatariosRepository.save(row);
    return this.findOne(Number(saved.id));
  }

  async findOne(id: number) {
    const data = await this.pagosArrendatariosRepository.findOne({
      where: { id },
      relations: FULL_RELATIONS,
    });
    if (!data) {
      throw new NotFoundException(
        `Pago de arrendatario con id ${id} no encontrado`,
      );
    }
    return data;
  }

  async updateEstatus(id: number, estatus: PagoEstatus) {
    const pago = await this.pagosArrendatariosRepository.findOne({
      where: { id },
      select: ["id"],
    });
    if (!pago) {
      throw new NotFoundException(
        `Pago de arrendatario con id ${id} no encontrado`,
      );
    }

    await this.pagosArrendatariosRepository.update(id, { estatus });

    return {
      status: "success",
      message: "Estatus del pago de arrendatario actualizado correctamente.",
      data: await this.findOne(id),
    };
  }

  async findAllPaginated(
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const skip = (safePage - 1) * safeLimit;

    const [idRows, total] =
      await this.pagosArrendatariosRepository.findAndCount({
        select: ["id"],
        order: { id: "DESC" },
        skip,
        take: safeLimit,
      });

    if (idRows.length === 0) {
      return {
        data: [],
        paginated: {
          total,
          page: safePage,
          lastPage: total === 0 ? 0 : Math.ceil(total / safeLimit),
        },
      };
    }

    const ids = idRows.map((r) => r.id);
    const data = await this.pagosArrendatariosRepository.find({
      where: { id: In(ids) },
      relations: FULL_RELATIONS,
      order: { id: "DESC" },
    });

    return {
      data,
      paginated: {
        total,
        page: safePage,
        lastPage: Math.ceil(total / safeLimit),
      },
    };
  }
}
