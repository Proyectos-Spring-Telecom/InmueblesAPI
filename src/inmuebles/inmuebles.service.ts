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
import { ArchivosInmuebles } from "src/entities/ArchivosInmuebles";
import { S3Service } from "src/s3/s3.service";
import { ApiResponseCommon } from "src/common/ApiResponse";
import { CreateInmuebleDto } from "./dto/create-inmueble.dto";

const FOLDER_SERVICIOS = "Servicios Inmuebles";
const FOLDER_DOCUMENTACION = "Documentación Inmueble";
const FOLDER_IMAGENES = "Imagenes Inmueble";
const ID_MODULE = 1;

const FULL_RELATIONS = [
  "arrendador",
  "servicios",
  "servicios.tipoServicio",
  "zonas",
  "archivos",
];

type SavedServicio = {
  id: number;
  idTipoServicio: number;
  urlComprobante: string | null;
};
type SavedZona = { id: number; zonaPrincipal: string | null };
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
  ) {}

  /**
   * Registra el inmueble completo dentro de una transacción:
   *  1) Inmuebles → idInmueble
   *  2) ServiciosInmuebles (subiendo comprobante a S3 → UrlComprobante)
   *  3) ZonasInmuebles
   *  4) ArchivosInmuebles (documentación + imágenes, ambas en la misma tabla)
   * Si falla cualquier paso, la transacción se revierte. Los archivos
   * que alcanzaron a subirse a S3 pueden quedar como huérfanos en el bucket.
   */
  async registrar(dto: CreateInmuebleDto, idUser: number) {
    return this.dataSource.transaction(async (manager) => {
      // 1) Inmueble
      const inmueble = manager.create(Inmuebles, {
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
      });
      const savedInmueble = await manager.save(Inmuebles, inmueble);
      const idInmueble = Number(savedInmueble.id);

      // 2) Servicios (con upload de comprobante a S3)
      const servicios: SavedServicio[] = [];
      for (let i = 0; i < (dto.servicios ?? []).length; i++) {
        const s = dto.servicios![i];
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
        servicios.push({
          id: Number(saved.id),
          idTipoServicio: s.idTipoServicio,
          urlComprobante,
        });
      }

      // 3) Zonas
      const zonas: SavedZona[] = [];
      for (const z of dto.zonas ?? []) {
        const row = manager.create(ZonasInmuebles, {
          idInmueble,
          zonaPrincipal: z.zonaPrincipal ?? null,
          // DECIMAL en TypeORM se guarda como string para preservar precisión
          superficieZonaM2:
            z.superficieZonaM2 != null ? String(z.superficieZonaM2) : null,
          superficieDisponibleM2:
            z.superficieDisponibleM2 != null
              ? String(z.superficieDisponibleM2)
              : null,
          numeroZona: z.numeroZona ?? null,
        });
        const saved = await manager.save(ZonasInmuebles, row);
        zonas.push({ id: Number(saved.id), zonaPrincipal: saved.zonaPrincipal });
      }

      // 4) Archivos (documentación) e Imágenes → ambos van a ArchivosInmuebles
      const archivos = await this.saveArchivos(
        manager,
        dto.archivos ?? [],
        idInmueble,
        idUser,
        FOLDER_DOCUMENTACION,
      );
      const imagenes = await this.saveArchivos(
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

  /**
   * Detalle de un inmueble con todas sus relaciones:
   * arrendador (Cliente), servicios (+ tipoServicio), zonas y archivos.
   */
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

  /** Inmuebles de un arrendador (Cliente) con todas sus relaciones. */
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
      order: { numeroZona: "ASC", id: "ASC" },
    });
  }

  /**
   * Listado paginado de inmuebles con todas sus relaciones.
   * Usa estrategia de dos pasos: primero obtiene los IDs paginados sin joins,
   * luego carga las entidades completas con relaciones por IN(ids) para no
   * romper la paginación al traer colecciones OneToMany.
   */
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

  private async saveArchivos(
    manager: import("typeorm").EntityManager,
    items: { nombre?: string; archivo?: any }[],
    idInmueble: number,
    idUser: number,
    folder: string,
  ): Promise<SavedArchivo[]> {
    const out: SavedArchivo[] = [];
    for (const item of items) {
      const file = item.archivo as Express.Multer.File | undefined;
      if (!file) continue; // sin binario no se guarda
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
