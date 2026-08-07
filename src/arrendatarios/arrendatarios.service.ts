import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { Arrendadores } from "src/entities/Arrendadores";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { ContratoLocales } from "src/entities/ContratoLocales";
import { LocalesZonaInmueble } from "src/entities/LocalesZonaInmueble";
import { ServiciosArrendatarios } from "src/entities/ServiciosArrendatarios";
import { ArchivosArrendatarios } from "src/entities/ArchivosArrendatarios";
import { SociosArrendatarios } from "src/entities/SociosArrendatarios";
import { Estacionamientos } from "src/entities/Estacionamientos";
import { PagosArrendatarios } from "src/entities/PagosArrendatarios";
import { S3Service } from "src/s3/s3.service";
import { ContratosService } from "src/contratos/contratos.service";
import { ApiCrudResponse, ApiResponseCommon } from "src/common/ApiResponse";
import { ContratoEstatus } from "src/common/contrato-estatus.enum";
import { LocalesEstatus } from "src/common/locales-estatus.enum";
import { resolveEntityId } from "src/common/resolve-entity-id";
import {
  getClienteHijos,
  isSuperAdmin,
} from "src/utils/cliente-utils";
import {
  estatusWhereForRol,
  filterArrendatarioRelations,
} from "src/utils/estatus-utils";
import { UpdateSocioArrendatarioDto } from "./dto/update-socio-arrendatario.dto";
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
import { UpdateArchivoArrendatarioDto } from "./dto/update-archivo-arrendatario.dto";
import { UpdateServicioArrendatarioItemDto } from "./dto/update-servicio-arrendatario.dto";

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
  "contratos.contratoLocales",
  "contratos.contratoLocales.local",
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
    private readonly contratosService: ContratosService,
    @InjectRepository(Arrendatarios)
    private readonly arrendatariosRepository: Repository<Arrendatarios>,
    @InjectRepository(Arrendadores)
    private readonly arrendadoresRepository: Repository<Arrendadores>,
    @InjectRepository(ServiciosArrendatarios)
    private readonly serviciosArrendatariosRepository: Repository<ServiciosArrendatarios>,
    @InjectRepository(ArchivosArrendatarios)
    private readonly archivosArrendatariosRepository: Repository<ArchivosArrendatarios>,
    @InjectRepository(SociosArrendatarios)
    private readonly sociosArrendatariosRepository: Repository<SociosArrendatarios>,
  ) {}

  private async arrendadorScopeWhere(
    rol: number,
    idCliente: number,
  ): Promise<{ idArrendador?: any } | null> {
    if (isSuperAdmin(rol)) return {};
    const { ids } = await getClienteHijos(this.arrendadoresRepository, idCliente);
    if (ids.length === 0) return null;
    return { idArrendador: In(ids) };
  }

  async findByIdInmueble(
    idInmueble: number,
    rol = 1,
  ): Promise<Arrendatarios[]> {
    const qb = this.arrendatariosRepository
      .createQueryBuilder("a")
      .select("a.id", "id")
      .distinct(true)
      .innerJoin("a.contratos", "contrato")
      .where("contrato.idInmueble = :idInmueble", { idInmueble });

    if (!isSuperAdmin(rol)) {
      qb.andWhere("a.estatus = 1");
    }

    const idRows = await qb.orderBy("a.id", "DESC").getRawMany<{ id: string }>();

    if (idRows.length === 0) {
      return [];
    }

    const ids = idRows.map((r) => Number(r.id));
    const data = await this.arrendatariosRepository.find({
      where: { id: In(ids) },
      relations: [...FULL_RELATIONS],
      order: { id: "DESC" },
    });

    return data.map((item) => filterArrendatarioRelations(item, rol));
  }

  async findOne(id: number, rol = 1): Promise<Arrendatarios> {
    const row = await this.arrendatariosRepository.findOne({
      where: { id, ...estatusWhereForRol(rol) },
      relations: [...FULL_RELATIONS],
    });
    if (!row) {
      throw new NotFoundException(`Arrendatario con id ${id} no encontrado.`);
    }
    return filterArrendatarioRelations(row, rol);
  }

  async findServiciosByIdArrendatario(idArrendatario: number, rol = 1) {
    const arrendatario = await this.arrendatariosRepository.findOne({
      where: { id: idArrendatario },
      select: ["id"],
    });
    if (!arrendatario) {
      throw new NotFoundException(
        `Arrendatario con id ${idArrendatario} no encontrado.`,
      );
    }

    return this.serviciosArrendatariosRepository.find({
      where: { idArrendatario, ...estatusWhereForRol(rol) },
      relations: ["tipoServicio"],
      order: { id: "ASC" },
    });
  }

  /** Baja de ContratoArrendatarios (estatus 0 + locales/contrato-locales). */
  async removeContratoArrendatario(id: number) {
    return this.contratosService.cancelarContrato(id);
  }

  async removeServicioArrendatario(id: number): Promise<ApiCrudResponse> {
    const row = await this.serviciosArrendatariosRepository.findOne({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException(
        `Servicio de arrendatario con id ${id} no encontrado.`,
      );
    }
    if (Number(row.estatus) === 0) {
      throw new BadRequestException(
        `El servicio de arrendatario con id ${id} ya está dado de baja.`,
      );
    }

    await this.serviciosArrendatariosRepository.update(id, { estatus: 0 });

    return {
      status: "success",
      message: "Servicio de arrendatario dado de baja correctamente.",
      data: { id, nombre: row.numeroContrato ?? "" },
    };
  }

  async removeSocioArrendatario(id: number): Promise<ApiCrudResponse> {
    const row = await this.sociosArrendatariosRepository.findOne({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException(
        `Socio de arrendatario con id ${id} no encontrado.`,
      );
    }
    if (Number(row.estatus) === 0) {
      throw new BadRequestException(
        `El socio de arrendatario con id ${id} ya está dado de baja.`,
      );
    }

    await this.sociosArrendatariosRepository.update(id, { estatus: 0 });

    return {
      status: "success",
      message: "Socio de arrendatario dado de baja correctamente.",
      data: { id, nombre: row.nombre ?? "" },
    };
  }

  async removeArchivoArrendatario(id: number): Promise<ApiCrudResponse> {
    const row = await this.archivosArrendatariosRepository.findOne({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException(
        `Archivo de arrendatario con id ${id} no encontrado.`,
      );
    }
    if (Number(row.estatus) === 0) {
      throw new BadRequestException(
        `El archivo de arrendatario con id ${id} ya está dado de baja.`,
      );
    }

    await this.archivosArrendatariosRepository.update(id, { estatus: 0 });

    return {
      status: "success",
      message: "Archivo de arrendatario dado de baja correctamente.",
      data: { id, nombre: row.nombre ?? "" },
    };
  }

  /**
   * Baja lógica del arrendatario (Estatus = 0) y dependencias con IdArrendatario
   * que tienen columna Estatus: servicios, socios, archivos, contratos (+ locales),
   * estacionamientos y pagos.
   */
  async removeArrendatario(id: number): Promise<ApiCrudResponse> {
    return this.dataSource.transaction(async (manager) => {
      const arrendatario = await manager.findOne(Arrendatarios, {
        where: { id },
      });
      if (!arrendatario) {
        throw new NotFoundException(
          `Arrendatario con id ${id} no encontrado.`,
        );
      }
      if (Number(arrendatario.estatus) === 0) {
        throw new BadRequestException(
          `El arrendatario con id ${id} ya está dado de baja.`,
        );
      }

      const fechaBaja = new Date();

      await manager.update(Arrendatarios, id, { estatus: 0 });

      await manager.update(
        ServiciosArrendatarios,
        { idArrendatario: id },
        { estatus: 0 },
      );
      await manager.update(
        SociosArrendatarios,
        { idArrendatario: id },
        { estatus: 0 },
      );
      await manager.update(
        ArchivosArrendatarios,
        { idArrendatario: id },
        { estatus: 0 },
      );
      await manager.update(
        Estacionamientos,
        { idArrendatario: id },
        { estatus: 0 },
      );
      await manager.update(
        PagosArrendatarios,
        { idArrendatario: id },
        { estatus: 0 },
      );

      const contratos = await manager.find(ContratoArrendatarios, {
        where: { idArrendatario: id },
        select: ["id", "estatus"],
      });

      for (const contrato of contratos) {
        if (Number(contrato.estatus) === ContratoEstatus.Baja) {
          continue;
        }

        await manager.update(ContratoArrendatarios, contrato.id, {
          estatus: ContratoEstatus.Baja,
          fechaBaja,
        });

        const contratoLocales = await manager.find(ContratoLocales, {
          where: { idContrato: contrato.id },
        });

        for (const contratoLocal of contratoLocales) {
          if (
            contratoLocal.fechaBaja != null ||
            Number(contratoLocal.estatus) === ContratoEstatus.Baja
          ) {
            continue;
          }

          await manager.update(ContratoLocales, contratoLocal.id, {
            fechaBaja,
            estatus: ContratoEstatus.Baja,
          });

          if (contratoLocal.idLocal != null) {
            await manager.update(LocalesZonaInmueble, contratoLocal.idLocal, {
              estatus: LocalesEstatus.Disponible,
            });
          }
        }
      }

      return {
        status: "success",
        message:
          "Arrendatario y dependencias dados de baja correctamente.",
        data: {
          id,
          nombre: arrendatario.arrendatario ?? "",
        },
      };
    });
  }

  async findAllActivos(
    idCliente: number,
    rol: number,
  ): Promise<{ data: Arrendatarios[] }> {
    const scope = await this.arrendadorScopeWhere(rol, idCliente);
    if (scope === null) {
      return { data: [] };
    }

    const data = await this.arrendatariosRepository.find({
      where: { ...estatusWhereForRol(rol), ...scope },
      relations: [...FULL_RELATIONS],
      order: { id: "DESC" },
    });

    return {
      data: data.map((item) => filterArrendatarioRelations(item, rol)),
    };
  }

  async findAllPaginated(
    page: number,
    limit: number,
    idCliente: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const skip = (safePage - 1) * safeLimit;

    const scope = await this.arrendadorScopeWhere(rol, idCliente);
    if (scope === null) {
      return {
        data: [],
        paginated: {
          total: 0,
          page: safePage,
          lastPage: 0,
        },
      };
    }

    const [idRows, total] = await this.arrendatariosRepository.findAndCount({
      select: ["id"],
      where: { ...scope, ...estatusWhereForRol(rol) },
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
      data: data.map((item) => filterArrendatarioRelations(item, rol)),
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

      const contratosOut = await this.upsertContratos(
        manager,
        dto.contratos ?? [],
        idArrendatario,
        false,
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
          contratos: contratosOut,
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

      const contratosOut = await this.upsertContratos(
        manager,
        dto.contratos ?? [],
        id,
      );

      const serviciosOut = await this.upsertServicios(
        manager,
        dto.servicios ?? [],
        id,
        idUser,
      );
      const archivosOut = await this.upsertArchivosLista(
        manager,
        dto.archivos ?? [],
        id,
        idUser,
        FOLDER_DOC,
      );
      const imagenesOut = await this.upsertArchivosLista(
        manager,
        dto.imagenes ?? [],
        id,
        idUser,
        FOLDER_IMG,
      );
      const sociosOut = await this.upsertSocios(
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
          contratos: contratosOut,
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
      rfc: a.rfc ?? null,
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
    if (a.rfc !== undefined) patch.rfc = a.rfc ?? null;
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
    if (c.incluyeMantenimiento !== undefined) {
      patch.incluyeMantenimiento = c.incluyeMantenimiento ?? 0;
    }
    return patch;
  }

  private async syncContratoLocales(
    manager: import("typeorm").EntityManager,
    contratoId: number,
    idLocales: number[] | undefined,
  ): Promise<void> {
    if (idLocales === undefined) return;

    const uniqueIds = [...new Set(idLocales)];

    if (uniqueIds.length > 0) {
      const found = await manager.find(LocalesZonaInmueble, {
        where: { id: In(uniqueIds) },
      });
      if (found.length !== uniqueIds.length) {
        const foundIds = new Set(found.map((l) => Number(l.id)));
        const missing = uniqueIds.filter((id) => !foundIds.has(id));
        throw new BadRequestException(
          `Locales no encontrados: ${missing.join(", ")}.`,
        );
      }
    }

    const existing = await manager.find(ContratoLocales, {
      where: { idContrato: contratoId },
    });
    const existingLocalIds = new Set(
      existing
        .map((row) => row.idLocal)
        .filter((id): id is number => id != null),
    );
    const newSet = new Set(uniqueIds);

    const toRemove = existing.filter(
      (row) => row.idLocal != null && !newSet.has(row.idLocal),
    );
    const toAdd = uniqueIds.filter((id) => !existingLocalIds.has(id));

    if (toRemove.length > 0) {
      await manager.delete(ContratoLocales, {
        id: In(toRemove.map((row) => row.id)),
      });
      for (const row of toRemove) {
        if (row.idLocal != null) {
          await manager.update(LocalesZonaInmueble, row.idLocal, {
            estatus: LocalesEstatus.Disponible,
          });
        }
      }
    }

    for (const idLocal of toAdd) {
      await manager.save(
        ContratoLocales,
        manager.create(ContratoLocales, {
          idContrato: contratoId,
          idLocal,
        }),
      );
    }

    for (const idLocal of uniqueIds) {
      await manager.update(LocalesZonaInmueble, idLocal, {
        estatus: LocalesEstatus.Ocupado,
      });
    }
  }

  private async upsertContrato(
    manager: import("typeorm").EntityManager,
    c:
      | ContratoArrendatarioJsonDto
      | UpdateContratoArrendatarioJsonDto
      | undefined,
    idArrendatario: number,
    upsert = true,
  ): Promise<number | null> {
    if (!c) return null;

    const updateDto = c as UpdateContratoArrendatarioJsonDto;
    let contratoId: number;
    const entityId = upsert ? resolveEntityId(updateDto.id) : undefined;

    if (entityId !== undefined) {
      const existing = await manager.findOne(ContratoArrendatarios, {
        where: { id: entityId, idArrendatario },
      });
      if (!existing) {
        throw new BadRequestException(
          `Contrato con id ${entityId} no pertenece al arrendatario ${idArrendatario}.`,
        );
      }
      const patch = this.buildContratoPatch(c);
      if (Object.keys(patch).length > 0) {
        await manager.update(ContratoArrendatarios, entityId, patch);
      }
      contratoId = entityId;
    } else {
      const contrato = manager.create(ContratoArrendatarios, {
        idArrendatario,
        ...this.buildContratoPatch(c),
      });
      const saved = await manager.save(ContratoArrendatarios, contrato);
      contratoId = Number(saved.id);
    }

    await this.syncContratoLocales(manager, contratoId, c.idLocales);

    return contratoId;
  }

  private async upsertContratos(
    manager: import("typeorm").EntityManager,
    items: (
      | ContratoArrendatarioJsonDto
      | UpdateContratoArrendatarioJsonDto
    )[],
    idArrendatario: number,
    upsert = true,
  ): Promise<{ id: number }[]> {
    const out: { id: number }[] = [];
    for (const c of items) {
      const id = await this.upsertContrato(manager, c, idArrendatario, upsert);
      if (id != null) out.push({ id });
    }
    return out;
  }

  private buildServicioArrendatarioPatch(
    s: UpdateServicioArrendatarioItemDto,
  ): Partial<ServiciosArrendatarios> {
    const patch: Partial<ServiciosArrendatarios> = {};
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

  private async appendServicios(
    manager: import("typeorm").EntityManager,
    items: RegistrarArrendatarioFormDto["servicios"],
    idArrendatario: number,
    idUser: number,
  ): Promise<{ id: number; idTipoServicio: number }[]> {
    return this.upsertServicios(
      manager,
      (items ?? []) as UpdateServicioArrendatarioItemDto[],
      idArrendatario,
      idUser,
      false,
    );
  }

  private async upsertServicios(
    manager: import("typeorm").EntityManager,
    items: UpdateServicioArrendatarioItemDto[],
    idArrendatario: number,
    idUser: number,
    upsert = true,
  ): Promise<{ id: number; idTipoServicio: number }[]> {
    const out: { id: number; idTipoServicio: number }[] = [];
    for (const s of items) {
      const file = s.archivo as Express.Multer.File | undefined;
      const entityId = upsert ? resolveEntityId(s.id) : undefined;

      if (entityId !== undefined) {
        const existing = await manager.findOne(ServiciosArrendatarios, {
          where: { id: entityId, idArrendatario },
        });
        if (!existing) {
          throw new BadRequestException(
            `Servicio con id ${entityId} no pertenece al arrendatario ${idArrendatario}.`,
          );
        }
        const patch = this.buildServicioArrendatarioPatch(s);
        if (file) {
          patch.urlComprobante = (
            await this.s3Service.uploadFile(
              file,
              FOLDER_SERVICIOS,
              idUser,
              ID_MODULE,
            )
          ).url;
        }
        if (Object.keys(patch).length > 0) {
          await manager.update(ServiciosArrendatarios, entityId, patch);
        }
        const updated = await manager.findOne(ServiciosArrendatarios, {
          where: { id: entityId },
        });
        out.push({
          id: entityId,
          idTipoServicio: Number(
            updated?.idTipoServicio ?? existing.idTipoServicio,
          ),
        });
        continue;
      }

      if (s.idTipoServicio === undefined) {
        throw new BadRequestException(
          "Para crear un servicio nuevo se requiere idTipoServicio.",
        );
      }
      let url: string | null = null;
      if (file) {
        url = (
          await this.s3Service.uploadFile(
            file,
            FOLDER_SERVICIOS,
            idUser,
            ID_MODULE,
          )
        ).url;
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
    return this.upsertSocios(
      manager,
      items as UpdateSocioArrendatarioDto[],
      idArrendatario,
      idUser,
      false,
    );
  }

  private buildSocioArrendatarioPatch(
    socio: UpdateSocioArrendatarioDto,
  ): Partial<SociosArrendatarios> {
    const patch: Partial<SociosArrendatarios> = {};
    if (socio.nombre !== undefined) {
      patch.nombre = socio.nombre ?? null;
    }
    if (socio.rfc !== undefined) {
      patch.rfc = socio.rfc ?? null;
    }
    return patch;
  }

  private async uploadSocioArrendatarioDocumentos(
    socio: UpdateSocioArrendatarioDto,
    idUser: number,
  ): Promise<Partial<SociosArrendatarios>> {
    const patch: Partial<SociosArrendatarios> = {};

    const fConst = socio.constanciaFiscalArchivo as
      | Express.Multer.File
      | undefined;
    if (fConst) {
      patch.constanciaSituacionFiscal = (
        await this.s3Service.uploadFile(
          fConst,
          FOLDER_SOCIO_CONST,
          idUser,
          ID_MODULE,
        )
      ).url;
    }

    const fComp = socio.comprobanteDomicilioArchivo as
      | Express.Multer.File
      | undefined;
    if (fComp) {
      patch.comprobanteDomicilio = (
        await this.s3Service.uploadFile(
          fComp,
          FOLDER_SOCIO_COMP,
          idUser,
          ID_MODULE,
        )
      ).url;
    }

    const fId = socio.identificacionOficialArchivo as
      | Express.Multer.File
      | undefined;
    if (fId) {
      patch.identificacionOficial = (
        await this.s3Service.uploadFile(fId, FOLDER_SOCIO_ID, idUser, ID_MODULE)
      ).url;
    }

    return patch;
  }

  private async upsertSocios(
    manager: import("typeorm").EntityManager,
    items: UpdateSocioArrendatarioDto[],
    idArrendatario: number,
    idUser: number,
    upsert = true,
  ): Promise<{ id: number; nombre: string }[]> {
    const out: { id: number; nombre: string }[] = [];
    for (const socio of items) {
      out.push(
        await this.upsertSocio(manager, socio, idArrendatario, idUser, upsert),
      );
    }
    return out;
  }

  private async upsertSocio(
    manager: import("typeorm").EntityManager,
    socio: UpdateSocioArrendatarioDto,
    idArrendatario: number,
    idUser: number,
    upsert = true,
  ): Promise<{ id: number; nombre: string }> {
    const entityId = upsert ? resolveEntityId(socio.id) : undefined;
    const filePatch = await this.uploadSocioArrendatarioDocumentos(
      socio,
      idUser,
    );

    if (entityId !== undefined) {
      const existing = await manager.findOne(SociosArrendatarios, {
        where: { id: entityId, idArrendatario },
      });
      if (!existing) {
        throw new BadRequestException(
          `Socio con id ${entityId} no pertenece al arrendatario ${idArrendatario}.`,
        );
      }
      const patch = {
        ...this.buildSocioArrendatarioPatch(socio),
        ...filePatch,
      };
      if (Object.keys(patch).length > 0) {
        await manager.update(SociosArrendatarios, entityId, patch);
      }
      const updated = await manager.findOne(SociosArrendatarios, {
        where: { id: entityId },
      });
      return {
        id: entityId,
        nombre: updated?.nombre ?? existing.nombre ?? "",
      };
    }

    if (!socio.nombre?.trim()) {
      throw new BadRequestException(
        "Para crear un socio nuevo se requiere nombre.",
      );
    }

    const row = manager.create(SociosArrendatarios, {
      idArrendatario,
      nombre: socio.nombre,
      rfc: socio.rfc ?? null,
      constanciaSituacionFiscal: filePatch.constanciaSituacionFiscal ?? null,
      comprobanteDomicilio: filePatch.comprobanteDomicilio ?? null,
      identificacionOficial: filePatch.identificacionOficial ?? null,
    });
    const saved = await manager.save(SociosArrendatarios, row);
    return { id: Number(saved.id), nombre: socio.nombre };
  }

  private async guardarArchivosLista(
    manager: import("typeorm").EntityManager,
    items: ArchivoConNombreDto[],
    idArrendatario: number,
    idUser: number,
    folder: string,
  ): Promise<{ id: number; nombre: string | null; url: string }[]> {
    return this.upsertArchivosLista(
      manager,
      items as UpdateArchivoArrendatarioDto[],
      idArrendatario,
      idUser,
      folder,
      false,
    );
  }

  private buildArchivoArrendatarioPatch(
    item: UpdateArchivoArrendatarioDto,
  ): Partial<ArchivosArrendatarios> {
    const patch: Partial<ArchivosArrendatarios> = {};
    if (item.nombre !== undefined) {
      patch.nombre = item.nombre ?? null;
    }
    return patch;
  }

  private async upsertArchivosLista(
    manager: import("typeorm").EntityManager,
    items: UpdateArchivoArrendatarioDto[],
    idArrendatario: number,
    idUser: number,
    folder: string,
    upsert = true,
  ): Promise<{ id: number; nombre: string | null; url: string }[]> {
    const out: { id: number; nombre: string | null; url: string }[] = [];
    for (const item of items) {
      const file = item.archivo as Express.Multer.File | undefined;
      const entityId = upsert ? resolveEntityId(item.id) : undefined;

      if (entityId !== undefined) {
        const existing = await manager.findOne(ArchivosArrendatarios, {
          where: { id: entityId, idArrendatario },
        });
        if (!existing) {
          throw new BadRequestException(
            `Archivo con id ${entityId} no pertenece al arrendatario ${idArrendatario}.`,
          );
        }
        const patch = this.buildArchivoArrendatarioPatch(item);
        if (file) {
          patch.url = (
            await this.s3Service.uploadFile(
              file,
              folder,
              idUser,
              ID_MODULE,
            )
          ).url;
        }
        if (Object.keys(patch).length > 0) {
          await manager.update(ArchivosArrendatarios, entityId, patch);
        }
        const updated = await manager.findOne(ArchivosArrendatarios, {
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

}
