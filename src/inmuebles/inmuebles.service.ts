import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { Inmuebles } from "src/entities/Inmuebles";
import { ServiciosInmuebles } from "src/entities/ServiciosInmuebles";
import { ZonasInmuebles } from "src/entities/ZonasInmuebles";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { LocalesZonaInmueble } from "src/entities/LocalesZonaInmueble";
import { ArchivosInmuebles } from "src/entities/ArchivosInmuebles";
import { S3Service } from "src/s3/s3.service";
import { ApiResponseCommon } from "src/common/ApiResponse";
import { LocalesEstatus } from "src/common/locales-estatus.enum";
import { resolveEntityId } from "src/common/resolve-entity-id";
import { CreateInmuebleDto } from "./dto/create-inmueble.dto";
import { UpdateInmuebleDto } from "./dto/update-inmueble.dto";
import { CreateZonaInmuebleDto } from "./dto/create-zona-inmueble.dto";
import { CreateServicioInmuebleDto } from "./dto/create-servicio-inmueble.dto";
import { UpdateServicioInmuebleDto } from "./dto/update-servicio-inmueble.dto";
import { UpdateZonaInmuebleDto } from "./dto/update-zona-inmueble.dto";
import { UpdateLocalZonaInmuebleDto } from "./dto/update-local-zona-inmueble.dto";
import { CreateArchivoInmuebleDto } from "./dto/create-archivo-inmueble.dto";
import { UpdateArchivoInmuebleDto } from "./dto/update-archivo-inmueble.dto";

const FOLDER_SERVICIOS = "Servicios Inmuebles";
const FOLDER_DOCUMENTACION = "Documentación Inmueble";
const FOLDER_IMAGENES = "Imagenes Inmueble";
const FOLDER_FACHADAS_LOCALES = "FachadasLocales";
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
type SavedLocal = {
  id: number;
  nombre: string | null;
  fachadaUrl: string | null;
};
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
    @InjectRepository(ContratoArrendatarios)
    private readonly contratoRepository: Repository<ContratoArrendatarios>,
    @InjectRepository(ServiciosInmuebles)
    private readonly serviciosInmueblesRepository: Repository<ServiciosInmuebles>,
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
        idUser,
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

      const servicios = await this.upsertServicios(
        manager,
        dto.servicios ?? [],
        idInmueble,
        idUser,
      );
      const zonas = await this.upsertZonas(
        manager,
        dto.zonas ?? [],
        idInmueble,
        idUser,
      );
      const archivos = await this.upsertArchivos(
        manager,
        dto.archivos ?? [],
        idInmueble,
        idUser,
        FOLDER_DOCUMENTACION,
      );
      const imagenes = await this.upsertArchivos(
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

  async findServiciosByIdInmueble(idInmueble: number) {
    await this.assertInmuebleExists(idInmueble);
    return this.serviciosInmueblesRepository.find({
      where: { idInmueble },
      relations: ["tipoServicio"],
      order: { id: "ASC" },
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

  async findAreaOcupada(idInmueble: number) {
    const inmueble = await this.inmueblesRepository.findOne({
      where: { id: idInmueble },
      select: ["id", "totalM2"],
    });
    if (!inmueble) {
      throw new NotFoundException(`Inmueble con id ${idInmueble} no encontrado.`);
    }

    const locales = await this.localesRepository
      .createQueryBuilder("local")
      .innerJoinAndSelect("local.zona", "zona")
      .innerJoin("zona.inmueble", "inmueble")
      .leftJoinAndSelect("local.contratoLocales", "contratoLocal")
      .leftJoinAndSelect("contratoLocal.contrato", "contrato")
      .leftJoinAndSelect("contrato.arrendatario", "arrendatario")
      .where("inmueble.id = :idInmueble", { idInmueble })
      .andWhere("local.estatus = :estatus", { estatus: LocalesEstatus.Ocupado })
      .orderBy("zona.numeroZona", "ASC")
      .addOrderBy("local.id", "ASC")
      .getMany();

    const zonasMap = new Map<
      number,
      {
        id: number;
        zonaPrincipal: string | null;
        superficieZonaM2: string | null;
        superficieDisponibleM2: string | null;
        numeroZona: number | null;
        estatus: number | null;
        localesRentados: Array<{
          id: number;
          nombre: string | null;
          areaM2: string | null;
          idContrato: number | null;
          idArrendatario: number | null;
          nombreArrendador: string | null;
        }>;
      }
    >();

    for (const local of locales) {
      const zona = local.zona;
      if (!zona?.id) continue;

      const contratoLocal = this.pickContratoLocalActivo(local.contratoLocales);
      const contrato = contratoLocal?.contrato;

      const localItem = {
        id: local.id,
        nombre: local.nombre,
        areaM2: local.areaM2,
        idContrato: contrato?.id ?? null,
        idArrendatario: contrato?.idArrendatario ?? null,
        nombreArrendador: contrato?.arrendatario?.arrendatario ?? null,
      };

      const existing = zonasMap.get(zona.id);
      if (existing) {
        existing.localesRentados.push(localItem);
        continue;
      }

      zonasMap.set(zona.id, {
        id: zona.id,
        zonaPrincipal: zona.zonaPrincipal,
        superficieZonaM2: zona.superficieZonaM2,
        superficieDisponibleM2: zona.superficieDisponibleM2,
        numeroZona: zona.numeroZona,
        estatus: zona.estatus,
        localesRentados: [localItem],
      });
    }

    const zonas = [...zonasMap.values()].sort((a, b) => {
      const zonaA = a.numeroZona ?? 0;
      const zonaB = b.numeroZona ?? 0;
      if (zonaA !== zonaB) return Number(zonaA) - Number(zonaB);
      return a.id - b.id;
    });

    return {
      totalM2: inmueble.totalM2,
      zonas,
    };
  }

  private pickContratoLocalActivo(
    contratoLocales: LocalesZonaInmueble["contratoLocales"],
  ) {
    if (!contratoLocales?.length) {
      return undefined;
    }

    const activo = contratoLocales.find((cl) => cl.contrato?.estatus === 1);
    return activo ?? contratoLocales[0];
  }

  async findLocalesLibresByIdInmueble(idInmueble: number) {
    await this.assertInmuebleExists(idInmueble);
    return this.queryLocalesByInmueble(idInmueble, LocalesEstatus.Disponible);
  }

  async findLocalesLibresYAsignadosContrato(
    idInmueble: number,
    idContrato: number,
  ) {
    await this.assertInmuebleExists(idInmueble);
    await this.assertContratoPerteneceInmueble(idContrato, idInmueble);

    const [libres, asignados] = await Promise.all([
      this.queryLocalesByInmueble(idInmueble, LocalesEstatus.Disponible),
      this.queryLocalesAsignadosContrato(idInmueble, idContrato),
    ]);

    const locales = [
      ...asignados.map((local) => ({
        ...local,
        asignadoAlContrato: true,
      })),
      ...libres.map((local) => ({
        ...local,
        asignadoAlContrato: false,
      })),
    ].sort((a, b) => {
      const zonaA = a.zona?.numeroZona ?? 0;
      const zonaB = b.zona?.numeroZona ?? 0;
      if (zonaA !== zonaB) return Number(zonaA) - Number(zonaB);
      return a.id - b.id;
    });

    return locales;
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

  private async assertContratoPerteneceInmueble(
    idContrato: number,
    idInmueble: number,
  ): Promise<void> {
    const contrato = await this.contratoRepository.findOne({
      where: { id: idContrato },
      select: ["id", "idInmueble"],
    });
    if (!contrato) {
      throw new NotFoundException(`Contrato con id ${idContrato} no encontrado.`);
    }
    if (Number(contrato.idInmueble) !== idInmueble) {
      throw new BadRequestException(
        `El contrato ${idContrato} no pertenece al inmueble ${idInmueble}.`,
      );
    }
  }

  private queryLocalesAsignadosContrato(idInmueble: number, idContrato: number) {
    return this.localesRepository
      .createQueryBuilder("local")
      .innerJoinAndSelect("local.zona", "zona")
      .innerJoin("zona.inmueble", "inmueble")
      .innerJoin("local.contratoLocales", "contratoLocal")
      .where("inmueble.id = :idInmueble", { idInmueble })
      .andWhere("contratoLocal.idContrato = :idContrato", { idContrato })
      .orderBy("zona.numeroZona", "ASC")
      .addOrderBy("local.id", "ASC")
      .getMany();
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
      totalM2:
        dto.totalM2 !== undefined && dto.totalM2 !== null
          ? String(dto.totalM2)
          : null,
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
    if (dto.totalM2 !== undefined) {
      patch.totalM2 =
        dto.totalM2 !== null ? String(dto.totalM2) : null;
    }
    return patch;
  }

  private async appendServicios(
    manager: import("typeorm").EntityManager,
    items: CreateServicioInmuebleDto[],
    idInmueble: number,
    idUser: number,
  ): Promise<SavedServicio[]> {
    return this.upsertServicios(
      manager,
      items as UpdateServicioInmuebleDto[],
      idInmueble,
      idUser,
      false,
    );
  }

  private buildServicioInmueblePatch(
    s: UpdateServicioInmuebleDto,
  ): Partial<ServiciosInmuebles> {
    const patch: Partial<ServiciosInmuebles> = {};
    if (s.idTipoServicio !== undefined) {
      patch.idTipoServicio = s.idTipoServicio;
    }
    if (s.numeroContrato !== undefined) {
      patch.numeroContrato = s.numeroContrato ?? null;
    }
    if (s.fechaPago !== undefined) {
      patch.fechaPago = s.fechaPago ? new Date(s.fechaPago) : null;
    }
    if (s.ultimoDiaPago !== undefined) {
      patch.ultimoDiaPago = s.ultimoDiaPago ? new Date(s.ultimoDiaPago) : null;
    }
    return patch;
  }

  private async upsertServicios(
    manager: import("typeorm").EntityManager,
    items: UpdateServicioInmuebleDto[],
    idInmueble: number,
    idUser: number,
    upsert = true,
  ): Promise<SavedServicio[]> {
    const out: SavedServicio[] = [];
    for (const s of items) {
      const file = s.archivo as Express.Multer.File | undefined;
      const entityId = upsert ? resolveEntityId(s.id) : undefined;

      if (entityId !== undefined) {
        const existing = await manager.findOne(ServiciosInmuebles, {
          where: { id: entityId, idInmueble },
        });
        if (!existing) {
          throw new BadRequestException(
            `Servicio con id ${entityId} no pertenece al inmueble ${idInmueble}.`,
          );
        }
        const patch = this.buildServicioInmueblePatch(s);
        if (file) {
          const r = await this.s3Service.uploadFile(
            file,
            FOLDER_SERVICIOS,
            idUser,
            ID_MODULE,
          );
          patch.urlComprobante = r.url;
        }
        if (Object.keys(patch).length > 0) {
          await manager.update(ServiciosInmuebles, entityId, patch);
        }
        const updated = await manager.findOne(ServiciosInmuebles, {
          where: { id: entityId },
        });
        out.push({
          id: entityId,
          idTipoServicio: Number(
            updated?.idTipoServicio ?? existing.idTipoServicio,
          ),
          urlComprobante: updated?.urlComprobante ?? existing.urlComprobante,
        });
        continue;
      }

      if (s.idTipoServicio === undefined) {
        throw new BadRequestException(
          "Para crear un servicio nuevo se requiere idTipoServicio.",
        );
      }
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

  private buildZonaInmueblePatch(z: UpdateZonaInmuebleDto): Partial<ZonasInmuebles> {
    const patch: Partial<ZonasInmuebles> = {};
    if (z.zonaPrincipal !== undefined) {
      patch.zonaPrincipal = z.zonaPrincipal ?? null;
    }
    if (z.superficieZonaM2 !== undefined) {
      patch.superficieZonaM2 =
        z.superficieZonaM2 != null ? String(z.superficieZonaM2) : null;
    }
    if (z.superficieDisponibleM2 !== undefined) {
      patch.superficieDisponibleM2 =
        z.superficieDisponibleM2 != null
          ? String(z.superficieDisponibleM2)
          : null;
    }
    if (z.numeroZona !== undefined) {
      patch.numeroZona = z.numeroZona ?? null;
    }
    return patch;
  }

  private buildLocalZonaPatch(
    local: UpdateLocalZonaInmuebleDto,
  ): Partial<LocalesZonaInmueble> {
    const patch: Partial<LocalesZonaInmueble> = {};
    if (local.nombre !== undefined) patch.nombre = local.nombre ?? null;
    if (local.areaM2 !== undefined) {
      patch.areaM2 = local.areaM2 != null ? String(local.areaM2) : null;
    }
    if (local.estatus !== undefined) patch.estatus = local.estatus ?? null;
    if (local.mensualidad !== undefined) {
      patch.mensualidad =
        local.mensualidad != null ? String(local.mensualidad) : null;
    }
    if (local.giro !== undefined) patch.giro = local.giro ?? null;
    return patch;
  }

  private async uploadLocalFachada(
    local: UpdateLocalZonaInmuebleDto,
    idUser: number,
  ): Promise<string | undefined> {
    const file = local.fachada as Express.Multer.File | undefined;
    if (!file) return undefined;
    const r = await this.s3Service.uploadFile(
      file,
      FOLDER_FACHADAS_LOCALES,
      idUser,
      ID_MODULE,
    );
    return r.url;
  }

  private async upsertLocalesZona(
    manager: import("typeorm").EntityManager,
    items: UpdateLocalZonaInmuebleDto[],
    idZona: number,
    idUser: number,
    upsert = true,
  ): Promise<SavedLocal[]> {
    const out: SavedLocal[] = [];
    for (const local of items) {
      const entityId = upsert ? resolveEntityId(local.id) : undefined;

      if (entityId !== undefined) {
        const existing = await manager.findOne(LocalesZonaInmueble, {
          where: { id: entityId, idZona },
        });
        if (!existing) {
          throw new BadRequestException(
            `Local con id ${entityId} no pertenece a la zona ${idZona}.`,
          );
        }
        const patch = this.buildLocalZonaPatch(local);
        const fachadaUrl = await this.uploadLocalFachada(local, idUser);
        if (fachadaUrl !== undefined) {
          patch.fachadaUrl = fachadaUrl;
        }
        if (Object.keys(patch).length > 0) {
          await manager.update(LocalesZonaInmueble, entityId, patch);
        }
        const updated = await manager.findOne(LocalesZonaInmueble, {
          where: { id: entityId },
        });
        out.push({
          id: entityId,
          nombre: updated?.nombre ?? existing.nombre,
          fachadaUrl: updated?.fachadaUrl ?? existing.fachadaUrl,
        });
        continue;
      }

      const fachadaUrl =
        (await this.uploadLocalFachada(local, idUser)) ?? null;
      const row = manager.create(LocalesZonaInmueble, {
        idZona,
        nombre: local.nombre ?? null,
        areaM2: local.areaM2 != null ? String(local.areaM2) : null,
        estatus: local.estatus ?? LocalesEstatus.Disponible,
        mensualidad:
          local.mensualidad != null ? String(local.mensualidad) : null,
        giro: local.giro ?? null,
        fachadaUrl,
      });
      const saved = await manager.save(LocalesZonaInmueble, row);
      out.push({
        id: Number(saved.id),
        nombre: saved.nombre,
        fachadaUrl: saved.fachadaUrl,
      });
    }
    return out;
  }

  private async appendZonas(
    manager: import("typeorm").EntityManager,
    items: CreateZonaInmuebleDto[],
    idInmueble: number,
    idUser: number,
  ): Promise<SavedZona[]> {
    return this.upsertZonas(
      manager,
      items as UpdateZonaInmuebleDto[],
      idInmueble,
      idUser,
      false,
    );
  }

  private async upsertZonas(
    manager: import("typeorm").EntityManager,
    items: UpdateZonaInmuebleDto[],
    idInmueble: number,
    idUser: number,
    upsert = true,
  ): Promise<SavedZona[]> {
    const out: SavedZona[] = [];
    for (const z of items) {
      const entityId = upsert ? resolveEntityId(z.id) : undefined;

      if (entityId !== undefined) {
        const existing = await manager.findOne(ZonasInmuebles, {
          where: { id: entityId, idInmueble },
        });
        if (!existing) {
          throw new BadRequestException(
            `Zona con id ${entityId} no pertenece al inmueble ${idInmueble}.`,
          );
        }
        const patch = this.buildZonaInmueblePatch(z);
        if (Object.keys(patch).length > 0) {
          await manager.update(ZonasInmuebles, entityId, patch);
        }
        const locales = await this.upsertLocalesZona(
          manager,
          z.locales ?? [],
          entityId,
          idUser,
          upsert,
        );
        const updated = await manager.findOne(ZonasInmuebles, {
          where: { id: entityId },
        });
        out.push({
          id: entityId,
          zonaPrincipal: updated?.zonaPrincipal ?? existing.zonaPrincipal,
          locales,
        });
        continue;
      }

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
      const locales = await this.upsertLocalesZona(
        manager,
        z.locales ?? [],
        idZona,
        idUser,
        upsert,
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
    return this.upsertArchivos(
      manager,
      items as UpdateArchivoInmuebleDto[],
      idInmueble,
      idUser,
      folder,
      false,
    );
  }

  private buildArchivoInmueblePatch(
    item: UpdateArchivoInmuebleDto,
  ): Partial<ArchivosInmuebles> {
    const patch: Partial<ArchivosInmuebles> = {};
    if (item.nombre !== undefined) {
      patch.nombre = item.nombre ?? null;
    }
    return patch;
  }

  private async upsertArchivos(
    manager: import("typeorm").EntityManager,
    items: UpdateArchivoInmuebleDto[],
    idInmueble: number,
    idUser: number,
    folder: string,
    upsert = true,
  ): Promise<SavedArchivo[]> {
    const out: SavedArchivo[] = [];
    for (const item of items) {
      const file = item.archivo as Express.Multer.File | undefined;
      const entityId = upsert ? resolveEntityId(item.id) : undefined;

      if (entityId !== undefined) {
        const existing = await manager.findOne(ArchivosInmuebles, {
          where: { id: entityId, idInmueble },
        });
        if (!existing) {
          throw new BadRequestException(
            `Archivo con id ${entityId} no pertenece al inmueble ${idInmueble}.`,
          );
        }
        const patch = this.buildArchivoInmueblePatch(item);
        if (file) {
          const r = await this.s3Service.uploadFile(
            file,
            folder,
            idUser,
            ID_MODULE,
          );
          patch.url = r.url;
        }
        if (Object.keys(patch).length > 0) {
          await manager.update(ArchivosInmuebles, entityId, patch);
        }
        const updated = await manager.findOne(ArchivosInmuebles, {
          where: { id: entityId },
        });
        out.push({
          id: entityId,
          nombre: updated?.nombre ?? existing.nombre,
          url: updated?.url ?? existing.url ?? "",
        });
        continue;
      }

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

}
