import {
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { Inmuebles } from "src/entities/Inmuebles";
import { ServiciosInmuebles } from "src/entities/ServiciosInmuebles";
import { ZonasInmuebles } from "src/entities/ZonasInmuebles";
import { LocalesZonaInmueble } from "src/entities/LocalesZonaInmueble";
import { CreateLocalZonaInmuebleDto } from "./dto/create-local-zona-inmueble.dto";
import { ArchivosInmuebles } from "src/entities/ArchivosInmuebles";
import { S3Service } from "src/s3/s3.service";
import { ApiResponseCommon } from "src/common/ApiResponse";
import { LocalesEstatus } from "src/common/locales-estatus.enum";
import { CreateInmuebleDto } from "./dto/create-inmueble.dto";
import { UpdateInmuebleDto } from "./dto/update-inmueble.dto";
import { CreateZonaInmuebleDto } from "./dto/create-zona-inmueble.dto";
import { CreateServicioInmuebleDto } from "./dto/create-servicio-inmueble.dto";
import { CreateArchivoInmuebleDto } from "./dto/create-archivo-inmueble.dto";

const FOLDER_SERVICIOS = "Servicios Inmuebles";
const FOLDER_DOCUMENTACION = "Documentación Inmueble";
const FOLDER_IMAGENES = "Imagenes Inmueble";
const ID_MODULE = 1;

const FULL_RELATIONS = [
  "arrendador",
  "servicios",
  "servicios.tipoServicio",
  "zonas",
  "zonas.locales",
  "archivos",
];

type SavedServicio = {
  id: number;
  idTipoServicio: number;
  urlComprobante: string | null;
};
type SavedLocal = { id: number; nombre: string | null };
type SavedZona = {
  id: number;
  zonaPrincipal: string | null;
  locales: SavedLocal[];
};
type SavedArchivo = { id: number; nombre: string | null; url: string };

@Injectable()
export class InmueblesService {
  private readonly logger = new Logger(InmueblesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly s3Service: S3Service,
    @InjectRepository(Inmuebles)
    private readonly inmueblesRepository: Repository<Inmuebles>,
    @InjectRepository(ZonasInmuebles)
    private readonly zonasRepository: Repository<ZonasInmuebles>,
    @InjectRepository(LocalesZonaInmueble)
    private readonly localesRepository: Repository<LocalesZonaInmueble>,
  ) {}

  async registrar(dto: CreateInmuebleDto, idUser: number) {
    return this.dataSource.transaction(async (manager) => {
      const inmueble = manager.create(Inmuebles, this.buildInmuebleEntity(dto));
      const savedInmueble = await manager.save(Inmuebles, inmueble);
      const idInmueble = Number(savedInmueble.id);

      const servicios = await this.appendServicios(
        manager,
        dto.servicios ?? [],
        idInmueble,
        idUser,
      );
      const zonas = await this.appendZonas(
        manager,
        dto.zonas ?? [],
        idInmueble,
      );
      const archivos = await this.appendArchivos(
        manager,
        dto.archivos ?? [],
        idInmueble,
        idUser,
        FOLDER_DOCUMENTACION,
      );
      const imagenes = await this.appendArchivos(
        manager,
        dto.imagenes ?? [],
        idInmueble,
        idUser,
        FOLDER_IMAGENES,
      );

      this.logger.log(
        `Inmueble ${idInmueble} registrado por usuario ${idUser} con ` +
          `${servicios.length} servicios, ${zonas.length} zonas, ` +
          `${archivos.length} archivos y ${imagenes.length} imágenes.`,
      );

      return {
        status: "success",
        message: "Inmueble registrado correctamente.",
        data: {
          idInmueble,
          inmueble: savedInmueble.inmueble,
          servicios,
          zonas,
          archivos,
          imagenes,
        },
      };
    });
  }

  async actualizar(idInmueble: number, dto: UpdateInmuebleDto, idUser: number) {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Inmuebles, {
        where: { id: idInmueble },
      });
      if (!existing) {
        throw new NotFoundException(`Inmueble con id ${idInmueble} no encontrado.`);
      }

      const patch = this.buildInmueblePatch(dto);
      if (Object.keys(patch).length > 0) {
        await manager.update(Inmuebles, idInmueble, patch);
      }

      const servicios = await this.appendServicios(
        manager,
        dto.servicios ?? [],
        idInmueble,
        idUser,
      );
      const zonas = await this.appendZonas(manager, dto.zonas ?? [], idInmueble);
      const archivos = await this.appendArchivos(
        manager,
        dto.archivos ?? [],
        idInmueble,
        idUser,
        FOLDER_DOCUMENTACION,
      );
      const imagenes = await this.appendArchivos(
        manager,
        dto.imagenes ?? [],
        idInmueble,
        idUser,
        FOLDER_IMAGENES,
      );

      const updated = await manager.findOne(Inmuebles, {
        where: { id: idInmueble },
      });

      this.logger.log(`Inmueble ${idInmueble} actualizado por usuario ${idUser}.`);

      return {
        status: "success",
        message: "Inmueble actualizado correctamente.",
        data: {
          idInmueble,
          inmueble: updated?.inmueble ?? existing.inmueble,
          servicios,
          zonas,
          archivos,
          imagenes,
        },
      };
    });
  }

  async findOne(id: number) {
    const data = await this.inmueblesRepository.findOne({
      where: { id },
      relations: FULL_RELATIONS,
    });
    if (!data) {
      throw new NotFoundException(`Inmueble con id ${id} no encontrado.`);
    }
    return data;
  }

  async updateMapaInmueble(
    id: number,
    mapaInmueble: object | null | undefined,
  ) {
    const existing = await this.inmueblesRepository.findOne({
      where: { id },
      select: ["id"],
    });
    if (!existing) {
      throw new NotFoundException(`Inmueble con id ${id} no encontrado.`);
    }

    const value = mapaInmueble === undefined ? null : mapaInmueble;
    await this.inmueblesRepository.update(id, { mapaInmueble: value });

    return {
      status: "success",
      message: "Mapa del inmueble actualizado correctamente.",
      data: { idInmueble: id, mapaInmueble: value },
    };
  }

  async findByIdArrendador(idArrendador: number) {
    return this.inmueblesRepository.find({
      where: { idArrendador },
      relations: FULL_RELATIONS,
      order: { id: "DESC" },
    });
  }

  async findZonasByIdInmueble(idInmueble: number) {
    return this.zonasRepository.find({
      where: { idInmueble },
      relations: ["locales"],
      order: {
        numeroZona: "ASC",
        id: "ASC",
        locales: { id: "ASC" },
      },
    });
  }

  async findLocalesByIdInmueble(idInmueble: number) {
    await this.assertInmuebleExists(idInmueble);
    return this.queryLocalesByInmueble(idInmueble);
  }

  async findLocalesLibresByIdInmueble(idInmueble: number) {
    await this.assertInmuebleExists(idInmueble);
    return this.queryLocalesByInmueble(idInmueble, LocalesEstatus.Disponible);
  }

  async updateLocalEstatus(idLocal: number, estatus: LocalesEstatus) {
    const local = await this.localesRepository.findOne({
      where: { id: idLocal },
    });
    if (!local) {
      throw new NotFoundException(`Local con id ${idLocal} no encontrado.`);
    }

    await this.localesRepository.update(idLocal, { estatus });

    return {
      status: "success",
      message: "Estatus del local actualizado correctamente.",
      data: { idLocal, estatus },
    };
  }

  private async assertInmuebleExists(idInmueble: number): Promise<void> {
    const inmueble = await this.inmueblesRepository.findOne({
      where: { id: idInmueble },
      select: ["id"],
    });
    if (!inmueble) {
      throw new NotFoundException(`Inmueble con id ${idInmueble} no encontrado.`);
    }
  }

  private queryLocalesByInmueble(idInmueble: number, estatus?: LocalesEstatus) {
    const qb = this.localesRepository
      .createQueryBuilder("local")
      .innerJoinAndSelect("local.zona", "zona")
      .innerJoin("zona.inmueble", "inmueble")
      .where("inmueble.id = :idInmueble", { idInmueble });

    if (estatus !== undefined) {
      qb.andWhere("local.estatus = :estatus", { estatus });
    }

    return qb
      .orderBy("zona.numeroZona", "ASC")
      .addOrderBy("local.id", "ASC")
      .getMany();
  }

  async findAllPaginated(
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const skip = (safePage - 1) * safeLimit;

    const [idRows, total] = await this.inmueblesRepository.findAndCount({
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
    const data = await this.inmueblesRepository.find({
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

  private buildInmuebleEntity(dto: CreateInmuebleDto): Partial<Inmuebles> {
    return {
      inmueble: dto.inmueble,
      idArrendador: dto.idArrendador,
      direccionFiscal: dto.direccionFiscal ?? null,
      estatusInmueble: dto.estatusInmueble ?? null,
      vigenciaAnios: dto.vigenciaAnios ?? null,
      fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : null,
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
      nombreRepresentante: dto.nombreRepresentante ?? null,
      telefonoRepresentante: dto.telefonoRepresentante ?? null,
      correoRepresentante: dto.correoRepresentante ?? null,
      lat: dto.lat ?? null,
      lng: dto.lng ?? null,
    };
  }

  private buildInmueblePatch(dto: UpdateInmuebleDto): Partial<Inmuebles> {
    const patch: Partial<Inmuebles> = {};
    if (dto.inmueble !== undefined) patch.inmueble = dto.inmueble;
    if (dto.idArrendador !== undefined) patch.idArrendador = dto.idArrendador;
    if (dto.direccionFiscal !== undefined) {
      patch.direccionFiscal = dto.direccionFiscal ?? null;
    }
    if (dto.estatusInmueble !== undefined) {
      patch.estatusInmueble = dto.estatusInmueble ?? null;
    }
    if (dto.vigenciaAnios !== undefined) {
      patch.vigenciaAnios = dto.vigenciaAnios ?? null;
    }
    if (dto.fechaInicio !== undefined) {
      patch.fechaInicio = dto.fechaInicio ? new Date(dto.fechaInicio) : null;
    }
    if (dto.fechaFin !== undefined) {
      patch.fechaFin = dto.fechaFin ? new Date(dto.fechaFin) : null;
    }
    if (dto.nombreRepresentante !== undefined) {
      patch.nombreRepresentante = dto.nombreRepresentante ?? null;
    }
    if (dto.telefonoRepresentante !== undefined) {
      patch.telefonoRepresentante = dto.telefonoRepresentante ?? null;
    }
    if (dto.correoRepresentante !== undefined) {
      patch.correoRepresentante = dto.correoRepresentante ?? null;
    }
    if (dto.lat !== undefined) patch.lat = dto.lat ?? null;
    if (dto.lng !== undefined) patch.lng = dto.lng ?? null;
    return patch;
  }

  private async appendServicios(
    manager: import("typeorm").EntityManager,
    items: CreateServicioInmuebleDto[],
    idInmueble: number,
    idUser: number,
  ): Promise<SavedServicio[]> {
    const out: SavedServicio[] = [];
    for (const s of items) {
      const file = s.archivo as Express.Multer.File | undefined;
      let urlComprobante: string | null = null;
      if (file) {
        const r = await this.s3Service.uploadFile(
          file,
          FOLDER_SERVICIOS,
          idUser,
          ID_MODULE,
        );
        urlComprobante = r.url;
      }
      const row = manager.create(ServiciosInmuebles, {
        idTipoServicio: s.idTipoServicio,
        idInmueble,
        numeroContrato: s.numeroContrato ?? null,
        fechaPago: s.fechaPago ? new Date(s.fechaPago) : null,
        ultimoDiaPago: s.ultimoDiaPago ? new Date(s.ultimoDiaPago) : null,
        urlComprobante,
      });
      const saved = await manager.save(ServiciosInmuebles, row);
      out.push({
        id: Number(saved.id),
        idTipoServicio: s.idTipoServicio,
        urlComprobante,
      });
    }
    return out;
  }

  private async appendZonas(
    manager: import("typeorm").EntityManager,
    items: CreateZonaInmuebleDto[],
    idInmueble: number,
  ): Promise<SavedZona[]> {
    const out: SavedZona[] = [];
    for (const z of items) {
      const row = manager.create(ZonasInmuebles, {
        idInmueble,
        zonaPrincipal: z.zonaPrincipal ?? null,
        superficieZonaM2:
          z.superficieZonaM2 != null ? String(z.superficieZonaM2) : null,
        superficieDisponibleM2:
          z.superficieDisponibleM2 != null
            ? String(z.superficieDisponibleM2)
            : null,
        numeroZona: z.numeroZona ?? null,
      });
      const saved = await manager.save(ZonasInmuebles, row);
      const idZona = Number(saved.id);
      const locales = await this.saveLocalesZona(
        manager,
        z.locales ?? [],
        idZona,
      );
      out.push({
        id: idZona,
        zonaPrincipal: saved.zonaPrincipal,
        locales,
      });
    }
    return out;
  }

  private async appendArchivos(
    manager: import("typeorm").EntityManager,
    items: CreateArchivoInmuebleDto[],
    idInmueble: number,
    idUser: number,
    folder: string,
  ): Promise<SavedArchivo[]> {
    const out: SavedArchivo[] = [];
    for (const item of items) {
      const file = item.archivo as Express.Multer.File | undefined;
      if (!file) continue;
      const r = await this.s3Service.uploadFile(file, folder, idUser, ID_MODULE);
      const row = manager.create(ArchivosInmuebles, {
        idInmueble,
        url: r.url,
        nombre: item.nombre ?? file.originalname,
      });
      const saved = await manager.save(ArchivosInmuebles, row);
      out.push({ id: Number(saved.id), nombre: saved.nombre, url: r.url });
    }
    return out;
  }

  private async saveLocalesZona(
    manager: import("typeorm").EntityManager,
    items: CreateLocalZonaInmuebleDto[],
    idZona: number,
  ): Promise<SavedLocal[]> {
    const out: SavedLocal[] = [];
    for (const local of items) {
      const row = manager.create(LocalesZonaInmueble, {
        idZona,
        nombre: local.nombre ?? null,
        areaM2: local.areaM2 != null ? String(local.areaM2) : null,
        estatus: local.estatus ?? LocalesEstatus.Disponible,
        mensualidad:
          local.mensualidad != null ? String(local.mensualidad) : null,
        giro: local.giro ?? null,
      });
      const saved = await manager.save(LocalesZonaInmueble, row);
      out.push({ id: Number(saved.id), nombre: saved.nombre });
    }
    return out;
  }
}
