import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { ServiciosArrendatarios } from "src/entities/ServiciosArrendatarios";
import { ArchivosArrendatarios } from "src/entities/ArchivosArrendatarios";
import { SociosArrendatarios } from "src/entities/SociosArrendatarios";
import { S3Service } from "src/s3/s3.service";
import { ApiResponseCommon } from "src/common/ApiResponse";
import {
  RegistrarArrendatarioFormDto,
  SocioItemDto,
  ArchivoConNombreDto,
} from "./dto/registrar-arrendatario-form.dto";

const FOLDER_SERVICIOS = "Servicios Arrendatarios";
const FOLDER_DOC = "Documentación Arrendatario";
const FOLDER_IMG = "Imagenes Arrendatario";
const FOLDER_SOCIO_CONST = "Socios Arrendatarios/ConstanciaSituacionFiscal";
const FOLDER_SOCIO_COMP = "Socios Arrendatarios/ComprobanteDomicilio";
const FOLDER_SOCIO_ID = "Socios Arrendatarios/IdentificacionOficial";
const ID_MODULE = 1;

const FULL_RELATIONS = [
  "arrendador",
  "servicios",
  "servicios.tipoServicio",
  "archivos",
  "socios",
  "contratos",
  "contratos.inmueble",
] as const;

function decStr(v: number | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  return String(v);
}

function decStrMaybeInt(v: number | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  return String(v);
}

@Injectable()
export class ArrendatariosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly s3Service: S3Service,
    @InjectRepository(Arrendatarios)
    private readonly arrendatariosRepository: Repository<Arrendatarios>,
  ) {}

  async findOne(id: number): Promise<Arrendatarios> {
    const row = await this.arrendatariosRepository.findOne({
      where: { id },
      relations: [...FULL_RELATIONS],
    });
    if (!row) {
      throw new NotFoundException(`Arrendatario con id ${id} no encontrado.`);
    }
    return row;
  }

  async findAllPaginated(
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const skip = (safePage - 1) * safeLimit;

    const [idRows, total] = await this.arrendatariosRepository.findAndCount({
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
    const data = await this.arrendatariosRepository.find({
      where: { id: In(ids) },
      relations: [...FULL_RELATIONS],
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

  async registrarCompleto(
    dto: RegistrarArrendatarioFormDto,
    idUser: number,
  ) {
    const a = dto.arrendatario;

    return this.dataSource.transaction(async (manager) => {
      const arrendatario = manager.create(Arrendatarios, {
        arrendatario: a.arrendatario ?? null,
        idArrendador: a.idArrendador,
        tipoPersona: a.tipoPersona ?? null,
        renta:
          a.renta !== undefined && a.renta !== null ? String(a.renta) : null,
        fechaInicio: a.fechaInicio ? new Date(a.fechaInicio) : null,
        fechaFin: a.fechaFin ? new Date(a.fechaFin) : null,
        tiempoRenta: a.tiempoRenta ?? null,
        representanteLegal: a.representanteLegal ?? null,
        telefonoRepresentante: a.telefonoRepresentante ?? null,
        correoRepresentante: a.correoRepresentante ?? null,
        lat: a.lat ?? null,
        lng: a.lng ?? null,
      });
      const savedA = await manager.save(Arrendatarios, arrendatario);
      const idArrendatario = Number(savedA.id);

      let contratoId: number | null = null;
      if (dto.contratoArrendatario) {
        const c = dto.contratoArrendatario;
        const contrato = manager.create(ContratoArrendatarios, {
          idArrendatario:idArrendatario ?? null,
          idInmueble: c.idInmueble ?? null,
          fechaInicioContrato: c.fechaInicioContrato
            ? new Date(c.fechaInicioContrato)
            : null,
          fechaTerminoContrato: c.fechaTerminoContrato
            ? new Date(c.fechaTerminoContrato)
            : null,
          moneda: c.moneda ?? null,
          metrosRentados: decStr(c.metrosRentados),
          costoM2: decStr(c.costoM2),
          porcentajeMantenimiento: decStr(c.porcentajeMantenimiento),
          mesesDeposito: decStrMaybeInt(c.mesesDeposito),
          montoDeposito: decStr(c.montoDeposito),
          mesesAdelanto: decStrMaybeInt(c.mesesAdelanto),
          montoAdelanto: decStr(c.montoAdelanto),
          aniosForzososArrendador: c.aniosForzososArrendador ?? null,
          aniosForzososArrendatario: c.aniosForzososArrendatario ?? null,
          subTotalRenta: decStr(c.subTotalRenta),
          ivaRenta: decStr(c.ivaRenta),
          rentaTotal: decStr(c.rentaTotal),
          subTotalMantenimiento: decStr(c.subTotalMantenimiento),
          ivaMantenimiento: decStr(c.ivaMantenimiento),
          mantenimientoTotal: decStr(c.mantenimientoTotal),
          observaciones: c.observaciones ?? null,
        });
        const savedC = await manager.save(ContratoArrendatarios, contrato);
        contratoId = Number(savedC.id);
      }

      const serviciosOut: { id: number; idTipoServicio: number }[] = [];
      for (const s of dto.servicios ?? []) {
        const file = s.archivo as Express.Multer.File | undefined;
        let url: string | null = null;
        if (file) {
          const up = await this.s3Service.uploadFile(
            file,
            FOLDER_SERVICIOS,
            idUser,
            ID_MODULE,
          );
          url = up.url;
        }
        const row = manager.create(ServiciosArrendatarios, {
          idArrendatario,
          idTipoServicio: s.idTipoServicio,
          numeroContrato: s.numeroContrato ?? null,
          fechaPago: s.fechaPago ? new Date(s.fechaPago) : null,
          ultimoDiaPago: s.ultimoDiaPago ? new Date(s.ultimoDiaPago) : null,
          urlComprobante: url,
        });
        const saved = await manager.save(ServiciosArrendatarios, row);
        serviciosOut.push({
          id: Number(saved.id),
          idTipoServicio: s.idTipoServicio,
        });
      }

      const archivosOut = await this.guardarArchivosLista(
        manager,
        dto.archivos ?? [],
        idArrendatario,
        idUser,
        FOLDER_DOC,
      );
      const imagenesOut = await this.guardarArchivosLista(
        manager,
        dto.imagenes ?? [],
        idArrendatario,
        idUser,
        FOLDER_IMG,
      );

      const sociosOut: { id: number; nombre: string }[] = [];
      for (const socio of dto.socios ?? []) {
        const savedSocio = await this.guardarSocio(
          manager,
          socio,
          idArrendatario,
          idUser,
        );
        sociosOut.push(savedSocio);
      }

      return {
        status: "success",
        message: "Arrendatario y datos relacionados registrados correctamente.",
        data: {
          idArrendatario,
          idContrato: contratoId,
          servicios: serviciosOut,
          archivos: archivosOut,
          imagenes: imagenesOut,
          socios: sociosOut,
        },
      };
    });
  }

  private async guardarArchivosLista(
    manager: import("typeorm").EntityManager,
    items: ArchivoConNombreDto[],
    idArrendatario: number,
    idUser: number,
    folder: string,
  ): Promise<{ id: number; nombre: string | null; url: string }[]> {
    const out: { id: number; nombre: string | null; url: string }[] = [];
    for (const item of items) {
      const file = item.archivo as Express.Multer.File | undefined;
      if (!file) continue;
      const { url } = await this.s3Service.uploadFile(
        file,
        folder,
        idUser,
        ID_MODULE,
      );
      const row = manager.create(ArchivosArrendatarios, {
        idArrendatario,
        url,
        nombre: item.nombre ?? file.originalname,
      });
      const saved = await manager.save(ArchivosArrendatarios, row);
      out.push({
        id: Number(saved.id),
        nombre: saved.nombre,
        url,
      });
    }
    return out;
  }

  private async guardarSocio(
    manager: import("typeorm").EntityManager,
    socio: SocioItemDto,
    idArrendatario: number,
    idUser: number,
  ): Promise<{ id: number; nombre: string }> {
    let urlConst: string | null = null;
    let urlComp: string | null = null;
    let urlId: string | null = null;

    const fConst = socio.constanciaFiscalArchivo as Express.Multer.File | undefined;
    if (fConst) {
      urlConst = (
        await this.s3Service.uploadFile(
          fConst,
          FOLDER_SOCIO_CONST,
          idUser,
          ID_MODULE,
        )
      ).url;
    }
    const fComp = socio.comprobanteDomicilioArchivo as Express.Multer.File | undefined;
    if (fComp) {
      urlComp = (
        await this.s3Service.uploadFile(
          fComp,
          FOLDER_SOCIO_COMP,
          idUser,
          ID_MODULE,
        )
      ).url;
    }
    const fId = socio.identificacionOficialArchivo as Express.Multer.File | undefined;
    if (fId) {
      urlId = (
        await this.s3Service.uploadFile(fId, FOLDER_SOCIO_ID, idUser, ID_MODULE)
      ).url;
    }

    const row = manager.create(SociosArrendatarios, {
      idArrendatario,
      nombre: socio.nombre,
      rfc: socio.rfc ?? null,
      constanciaSituacionFiscal: urlConst,
      comprobanteDomicilio: urlComp,
      identificacionOficial: urlId,
    });
    const saved = await manager.save(SociosArrendatarios, row);
    return { id: Number(saved.id), nombre: socio.nombre };
  }
}
