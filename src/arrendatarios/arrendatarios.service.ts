import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { LocalesZonaInmueble } from "src/entities/LocalesZonaInmueble";
import { ServiciosArrendatarios } from "src/entities/ServiciosArrendatarios";
import { ArchivosArrendatarios } from "src/entities/ArchivosArrendatarios";
import { SociosArrendatarios } from "src/entities/SociosArrendatarios";
import { S3Service } from "src/s3/s3.service";
import { ApiResponseCommon } from "src/common/ApiResponse";
import { LocalesEstatus } from "src/common/locales-estatus.enum";
import {
  RegistrarArrendatarioFormDto,
  ContratoArrendatarioJsonDto,
  SocioItemDto,
  ArchivoConNombreDto,
} from "./dto/registrar-arrendatario-form.dto";
import {
  ActualizarArrendatarioFormDto,
  UpdateArrendatarioJsonDto,
  UpdateContratoArrendatarioJsonDto,
} from "./dto/actualizar-arrendatario-form.dto";

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
  "contratos.local",
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

  async findByIdInmueble(idInmueble: number): Promise<Arrendatarios[]> {
    const idRows = await this.arrendatariosRepository
      .createQueryBuilder("a")
      .select("a.id", "id")
      .distinct(true)
      .innerJoin("a.contratos", "contrato")
      .where("contrato.idInmueble = :idInmueble", { idInmueble })
      .orderBy("a.id", "DESC")
      .getRawMany<{ id: string }>();

    if (idRows.length === 0) {
      return [];
    }

    const ids = idRows.map((r) => Number(r.id));
    return this.arrendatariosRepository.find({
      where: { id: In(ids) },
      relations: [...FULL_RELATIONS],
      order: { id: "DESC" },
    });
  }

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
      const arrendatario = manager.create(
        Arrendatarios,
        this.buildArrendatarioEntity(a),
      );
      const savedA = await manager.save(Arrendatarios, arrendatario);
      const idArrendatario = Number(savedA.id);

      const contratoId = await this.upsertContrato(
        manager,
        dto.contratoArrendatario,
        idArrendatario,
      );

      const serviciosOut = await this.appendServicios(
        manager,
        dto.servicios ?? [],
        idArrendatario,
        idUser,
      );
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
      const sociosOut = await this.appendSocios(
        manager,
        dto.socios ?? [],
        idArrendatario,
        idUser,
      );

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

  async actualizarCompleto(
    id: number,
    dto: ActualizarArrendatarioFormDto,
    idUser: number,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Arrendatarios, {
        where: { id },
      });
      if (!existing) {
        throw new NotFoundException(
          `Arrendatario con id ${id} no encontrado.`,
        );
      }

      if (dto.arrendatario) {
        await this.patchArrendatario(manager, id, dto.arrendatario);
      }

      const contratoId = await this.upsertContrato(
        manager,
        dto.contratoArrendatario,
        id,
      );

      const serviciosOut = await this.appendServicios(
        manager,
        dto.servicios ?? [],
        id,
        idUser,
      );
      const archivosOut = await this.guardarArchivosLista(
        manager,
        dto.archivos ?? [],
        id,
        idUser,
        FOLDER_DOC,
      );
      const imagenesOut = await this.guardarArchivosLista(
        manager,
        dto.imagenes ?? [],
        id,
        idUser,
        FOLDER_IMG,
      );
      const sociosOut = await this.appendSocios(
        manager,
        dto.socios ?? [],
        id,
        idUser,
      );

      return {
        status: "success",
        message: "Arrendatario actualizado correctamente.",
        data: {
          idArrendatario: id,
          idContrato: contratoId,
          servicios: serviciosOut,
          archivos: archivosOut,
          imagenes: imagenesOut,
          socios: sociosOut,
        },
      };
    });
  }

  private buildArrendatarioEntity(
    a: UpdateArrendatarioJsonDto & { idArrendador?: number },
  ): Partial<Arrendatarios> {
    return {
      arrendatario: a.arrendatario ?? null,
      idArrendador: a.idArrendador!,
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
    };
  }

  private async patchArrendatario(
    manager: import("typeorm").EntityManager,
    id: number,
    a: UpdateArrendatarioJsonDto,
  ): Promise<void> {
    const patch: Partial<Arrendatarios> = {};
    if (a.arrendatario !== undefined) patch.arrendatario = a.arrendatario ?? null;
    if (a.idArrendador !== undefined) patch.idArrendador = a.idArrendador;
    if (a.tipoPersona !== undefined) patch.tipoPersona = a.tipoPersona ?? null;
    if (a.renta !== undefined) {
      patch.renta =
        a.renta !== null ? String(a.renta) : null;
    }
    if (a.fechaInicio !== undefined) {
      patch.fechaInicio = a.fechaInicio ? new Date(a.fechaInicio) : null;
    }
    if (a.fechaFin !== undefined) {
      patch.fechaFin = a.fechaFin ? new Date(a.fechaFin) : null;
    }
    if (a.tiempoRenta !== undefined) patch.tiempoRenta = a.tiempoRenta ?? null;
    if (a.representanteLegal !== undefined) {
      patch.representanteLegal = a.representanteLegal ?? null;
    }
    if (a.telefonoRepresentante !== undefined) {
      patch.telefonoRepresentante = a.telefonoRepresentante ?? null;
    }
    if (a.correoRepresentante !== undefined) {
      patch.correoRepresentante = a.correoRepresentante ?? null;
    }
    if (a.lat !== undefined) patch.lat = a.lat ?? null;
    if (a.lng !== undefined) patch.lng = a.lng ?? null;

    if (Object.keys(patch).length > 0) {
      await manager.update(Arrendatarios, id, patch);
    }
  }

  private buildContratoPatch(
    c: ContratoArrendatarioJsonDto | UpdateContratoArrendatarioJsonDto,
  ): Partial<ContratoArrendatarios> {
    const patch: Partial<ContratoArrendatarios> = {};
    if (c.idInmueble !== undefined) patch.idInmueble = c.idInmueble ?? null;
    if (c.idLocal !== undefined) patch.idLocal = c.idLocal ?? null;
    if (c.fechaInicioContrato !== undefined) {
      patch.fechaInicioContrato = c.fechaInicioContrato
        ? new Date(c.fechaInicioContrato)
        : null;
    }
    if (c.fechaTerminoContrato !== undefined) {
      patch.fechaTerminoContrato = c.fechaTerminoContrato
        ? new Date(c.fechaTerminoContrato)
        : null;
    }
    if (c.moneda !== undefined) patch.moneda = c.moneda ?? null;
    if (c.metrosRentados !== undefined) {
      patch.metrosRentados = decStr(c.metrosRentados);
    }
    if (c.costoM2 !== undefined) patch.costoM2 = decStr(c.costoM2);
    if (c.porcentajeMantenimiento !== undefined) {
      patch.porcentajeMantenimiento = decStr(c.porcentajeMantenimiento);
    }
    if (c.mesesDeposito !== undefined) {
      patch.mesesDeposito = decStrMaybeInt(c.mesesDeposito);
    }
    if (c.montoDeposito !== undefined) {
      patch.montoDeposito = decStr(c.montoDeposito);
    }
    if (c.mesesAdelanto !== undefined) {
      patch.mesesAdelanto = decStrMaybeInt(c.mesesAdelanto);
    }
    if (c.montoAdelanto !== undefined) {
      patch.montoAdelanto = decStr(c.montoAdelanto);
    }
    if (c.aniosForzososArrendador !== undefined) {
      patch.aniosForzososArrendador = c.aniosForzososArrendador ?? null;
    }
    if (c.aniosForzososArrendatario !== undefined) {
      patch.aniosForzososArrendatario = c.aniosForzososArrendatario ?? null;
    }
    if (c.subTotalRenta !== undefined) {
      patch.subTotalRenta = decStr(c.subTotalRenta);
    }
    if (c.ivaRenta !== undefined) patch.ivaRenta = decStr(c.ivaRenta);
    if (c.rentaTotal !== undefined) patch.rentaTotal = decStr(c.rentaTotal);
    if (c.subTotalMantenimiento !== undefined) {
      patch.subTotalMantenimiento = decStr(c.subTotalMantenimiento);
    }
    if (c.ivaMantenimiento !== undefined) {
      patch.ivaMantenimiento = decStr(c.ivaMantenimiento);
    }
    if (c.mantenimientoTotal !== undefined) {
      patch.mantenimientoTotal = decStr(c.mantenimientoTotal);
    }
    if (c.observaciones !== undefined) {
      patch.observaciones = c.observaciones ?? null;
    }
    return patch;
  }

  private async upsertContrato(
    manager: import("typeorm").EntityManager,
    c:
      | ContratoArrendatarioJsonDto
      | UpdateContratoArrendatarioJsonDto
      | undefined,
    idArrendatario: number,
  ): Promise<number | null> {
    if (!c) return null;

    if (c.idLocal != null) {
      const local = await manager.findOne(LocalesZonaInmueble, {
        where: { id: c.idLocal },
      });
      if (!local) {
        throw new BadRequestException(
          `Local con id ${c.idLocal} no encontrado.`,
        );
      }
    }

    const updateDto = c as UpdateContratoArrendatarioJsonDto;
    let contratoId: number;

    if (updateDto.id) {
      const existing = await manager.findOne(ContratoArrendatarios, {
        where: { id: updateDto.id, idArrendatario },
      });
      if (!existing) {
        throw new BadRequestException(
          `Contrato con id ${updateDto.id} no pertenece al arrendatario ${idArrendatario}.`,
        );
      }
      const patch = this.buildContratoPatch(c);
      if (Object.keys(patch).length > 0) {
        await manager.update(ContratoArrendatarios, updateDto.id, patch);
      }
      contratoId = updateDto.id;
    } else {
      const contrato = manager.create(ContratoArrendatarios, {
        idArrendatario,
        ...this.buildContratoPatch(c),
      });
      const saved = await manager.save(ContratoArrendatarios, contrato);
      contratoId = Number(saved.id);
    }

    if (c.idLocal != null) {
      await manager.update(LocalesZonaInmueble, c.idLocal, {
        estatus: LocalesEstatus.Ocupado,
      });
    }

    return contratoId;
  }

  private async appendServicios(
    manager: import("typeorm").EntityManager,
    items: RegistrarArrendatarioFormDto["servicios"],
    idArrendatario: number,
    idUser: number,
  ): Promise<{ id: number; idTipoServicio: number }[]> {
    const out: { id: number; idTipoServicio: number }[] = [];
    for (const s of items ?? []) {
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
      out.push({
        id: Number(saved.id),
        idTipoServicio: s.idTipoServicio,
      });
    }
    return out;
  }

  private async appendSocios(
    manager: import("typeorm").EntityManager,
    items: SocioItemDto[],
    idArrendatario: number,
    idUser: number,
  ): Promise<{ id: number; nombre: string }[]> {
    const out: { id: number; nombre: string }[] = [];
    for (const socio of items) {
      out.push(await this.guardarSocio(manager, socio, idArrendatario, idUser));
    }
    return out;
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
