import { isSuperAdmin } from "src/utils/cliente-utils";
import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BitacoraService } from "src/bitacora/bitacora.service";
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from "src/common/ApiResponse";
import { ContratoEstatus } from "src/common/contrato-estatus.enum";
import { LocalesEstatus } from "src/common/locales-estatus.enum";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { ContratoLocales } from "src/entities/ContratoLocales";
import { ContratosGenerados } from "src/entities/ContratosGenerados";
import { LocalesZonaInmueble } from "src/entities/LocalesZonaInmueble";
import { DataSource, Repository } from "typeorm";
import {
  PLANTILLA_SUBARRENDAMIENTO,
  plantillaSubarrendamientoEjemplo,
} from "./plantilla-subarrendamiento";
import { VistaPreviaPlantillaDto } from "./dto/vista-previa-plantilla.dto";
import { generarPdfSubarrendamiento } from "./vista-previa-subarrendamiento.pdf";

const ID_MODULE = 1;

const CONTRATO_RELATIONS = [
  "arrendatario",
  "inmueble",
  "contratoLocales",
  "contratoLocales.local",
] as const;

const CONTRATO_LOCAL_RELATIONS = ["contrato", "local", "local.zona"] as const;

@Injectable()
export class ContratosService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ContratoArrendatarios)
    private readonly contratoRepository: Repository<ContratoArrendatarios>,
    @InjectRepository(ContratoLocales)
    private readonly contratoLocalesRepository: Repository<ContratoLocales>,
    @InjectRepository(ContratosGenerados)
    private readonly contratosGeneradosRepository: Repository<ContratosGenerados>,
    private readonly bitacoraLogger: BitacoraService,
  ) {}

  obtenerPlantillaSubarrendamiento() {
    return PLANTILLA_SUBARRENDAMIENTO;
  }

  obtenerPlantillaSubarrendamientoEjemplo() {
    return plantillaSubarrendamientoEjemplo();
  }

  generarVistaPreviaEjemploSubarrendamiento(): Promise<Buffer> {
    return generarPdfSubarrendamiento(
      plantillaSubarrendamientoEjemplo().secciones,
    );
  }

  generarVistaPreviaSubarrendamiento(
    dto: VistaPreviaPlantillaDto,
  ): Promise<Buffer> {
    return generarPdfSubarrendamiento(dto.secciones ?? []);
  }

  async cancelarContratoLocal(idContratoLocal: number) {
    return this.dataSource.transaction(async (manager) => {
      const row = await manager.findOne(ContratoLocales, {
        where: { id: idContratoLocal },
        relations: ["contrato"],
      });

      if (!row) {
        throw new NotFoundException(
          `Contrato local con id ${idContratoLocal} no encontrado.`,
        );
      }

      if (row.fechaBaja != null || Number(row.estatus) === ContratoEstatus.Baja) {
        throw new BadRequestException(
          "El contrato local ya se encuentra cancelado.",
        );
      }

      if (row.contrato && Number(row.contrato.estatus) === ContratoEstatus.Baja) {
        throw new BadRequestException(
          "No se puede cancelar un local de un contrato ya cancelado.",
        );
      }

      const fechaBaja = new Date();

      await manager.update(ContratoLocales, idContratoLocal, {
        fechaBaja,
        estatus: ContratoEstatus.Baja,
      });

      if (row.idLocal != null) {
        await manager.update(LocalesZonaInmueble, row.idLocal, {
          estatus: LocalesEstatus.Disponible,
        });
      }

      const data = await manager.findOne(ContratoLocales, {
        where: { id: idContratoLocal },
        relations: [...CONTRATO_LOCAL_RELATIONS],
      });

      return {
        status: "success",
        message: "Contrato local cancelado correctamente.",
        data,
      };
    });
  }

  async cancelarContrato(idContrato: number) {
    return this.dataSource.transaction(async (manager) => {
      const contrato = await manager.findOne(ContratoArrendatarios, {
        where: { id: idContrato },
      });

      if (!contrato) {
        throw new NotFoundException(`Contrato con id ${idContrato} no encontrado.`);
      }

      if (Number(contrato.estatus) === ContratoEstatus.Baja) {
        throw new BadRequestException("El contrato ya se encuentra cancelado.");
      }

      const fechaBaja = new Date();

      await manager.update(ContratoArrendatarios, idContrato, {
        estatus: ContratoEstatus.Baja,
        fechaBaja,
      });

      const contratoLocales = await manager.find(ContratoLocales, {
        where: { idContrato },
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

      const data = await manager.findOne(ContratoArrendatarios, {
        where: { id: idContrato },
        relations: [...CONTRATO_RELATIONS],
      });

      return {
        status: "success",
        message:
          "Contrato cancelado correctamente. Sus locales asignados también fueron dados de baja.",
        data,
      };
    });
  }

  async findContrato(id: number) {
    const data = await this.contratoRepository.findOne({
      where: { id },
      relations: [...CONTRATO_RELATIONS],
    });
    if (!data) {
      throw new NotFoundException(`Contrato con id ${id} no encontrado.`);
    }
    return data;
  }

  async findContratoLocal(id: number) {
    const data = await this.contratoLocalesRepository.findOne({
      where: { id },
      relations: [...CONTRATO_LOCAL_RELATIONS],
    });
    if (!data) {
      throw new NotFoundException(
        `Contrato local con id ${id} no encontrado.`,
      );
    }
    return data;
  }

  async guardarContratoGenerado(
    dto: VistaPreviaPlantillaDto,
    idUsuario: number,
  ): Promise<ApiCrudResponse> {
    const datos = datosContrato(dto);
    try {
      const saved = await this.contratosGeneradosRepository.save(
        this.contratosGeneradosRepository.create({
          idUsuario,
          clave: datos.clave,
          nombre: datos.nombre,
          contenido: datos.contenido,
        }),
      );
      await this.bitacoraLogger.logToBitacora(
        "ContratosGenerados",
        `Contrato generado guardado: ${datos.nombre}.`,
        "CREATE",
        { id: Number(saved.id), clave: datos.clave, nombre: datos.nombre },
        idUsuario,
        ID_MODULE,
        EstatusEnumBitcora.SUCCESS,
      );
      return {
        status: "success",
        message: "El contrato se guardó correctamente.",
        data: { id: Number(saved.id), nombre: datos.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        "ContratosGenerados",
        "Error al guardar el contrato generado.",
        "CREATE",
        { clave: datos.clave, nombre: datos.nombre },
        idUsuario,
        ID_MODULE,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: "Ocurrió un error al guardar el contrato.",
      });
    }
  }

  async listarContratosGenerados(cliente: number, rol: number): Promise<ApiResponseCommon> {
    try {
      // Rol > 1: sólo contratos generados por usuarios de su cliente.
      const scope = isSuperAdmin(rol) ? { sql: "", params: [] as number[] } : { sql: "WHERE u.IdCliente = ?", params: [cliente] };
      const rows = await this.contratosGeneradosRepository.query(
        `
SELECT
  c.Id AS id,
  c.IdUsuario AS idUsuario,
  c.Clave AS clave,
  c.Nombre AS nombre,
  c.FHRegistro AS fhRegistro,
  c.FHUpdate AS fhUpdate,
  u.Nombre AS nombreUsuario,
  u.ApellidoPaterno AS apellidoPaternoUsuario,
  u.ApellidoMaterno AS apellidoMaternoUsuario
FROM ContratosGenerados c
LEFT JOIN Usuarios u ON u.Id = c.IdUsuario
${scope.sql}
ORDER BY c.Id DESC;
        `,
        scope.params,
      );
      return {
        data: rows.map((row) => ({
          id: Number(row.id),
          idUsuario: Number(row.idUsuario),
          nombreUsuario: nombreCompleto(
            row.nombreUsuario,
            row.apellidoPaternoUsuario,
            row.apellidoMaternoUsuario,
          ),
          clave: row.clave,
          nombre: row.nombre,
          fhRegistro: row.fhRegistro,
          fhUpdate: row.fhUpdate,
        })),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException({
        message: "Ocurrió un error al listar los contratos generados.",
      });
    }
  }

  async obtenerContratoGenerado(id: number) {
    const contrato = await this.buscarContratoGenerado(id);
    return { data: this.mapContratoGenerado(contrato, true) };
  }

  async actualizarContratoGenerado(
    id: number,
    dto: VistaPreviaPlantillaDto,
    idUsuario: number,
  ): Promise<ApiCrudResponse> {
    const actual = await this.buscarContratoGenerado(id);
    const datos = datosContrato(dto);
    try {
      await this.contratosGeneradosRepository.update(id, {
        clave: datos.clave,
        nombre: datos.nombre,
        contenido: datos.contenido,
        fhUpdate: new Date(),
      });
      await this.bitacoraLogger.logToBitacora(
        "ContratosGenerados",
        `Contrato generado ${id} actualizado: ${datos.nombre}.`,
        "UPDATE",
        { id, clave: datos.clave, nombre: datos.nombre },
        idUsuario,
        ID_MODULE,
        EstatusEnumBitcora.SUCCESS,
      );
      return {
        status: "success",
        message: "El contrato se actualizó correctamente.",
        data: { id: Number(actual.id), nombre: datos.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        "ContratosGenerados",
        `Error al actualizar el contrato generado ${id}.`,
        "UPDATE",
        { id, clave: datos.clave, nombre: datos.nombre },
        idUsuario,
        ID_MODULE,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: "Ocurrió un error al actualizar el contrato.",
      });
    }
  }

  private async buscarContratoGenerado(id: number): Promise<ContratosGenerados> {
    const contrato = await this.contratosGeneradosRepository.findOne({
      where: { id },
    });
    if (!contrato) {
      throw new NotFoundException(
        `El contrato generado con ID: ${id} no fue encontrado.`,
      );
    }
    return contrato;
  }

  private mapContratoGenerado(contrato: ContratosGenerados, conContenido: boolean) {
    const data: Record<string, unknown> = {
      id: Number(contrato.id),
      idUsuario: Number(contrato.idUsuario),
      clave: contrato.clave,
      nombre: contrato.nombre,
      fhRegistro: contrato.fhRegistro,
      fhUpdate: contrato.fhUpdate,
    };
    if (conContenido) {
      data.contenido = JSON.parse(contrato.contenido);
    }
    return data;
  }
}

function datosContrato(dto: VistaPreviaPlantillaDto) {
  const clave = dto.clave?.trim() || "subarrendamiento-local-comercial";
  const nombre = nombreListado(dto);
  return {
    clave,
    nombre,
    contenido: JSON.stringify({
      clave,
      nombre: dto.nombre?.trim() || nombre,
      secciones: dto.secciones ?? [],
    }),
  };
}

function nombreListado(dto: VistaPreviaPlantillaDto): string {
  const folio = valorCampo(dto, "documento", "folio");
  const persona = valorCampo(dto, "subarrendatario", "nombre");
  if (folio && persona) return `${folio} — ${persona}`;
  if (folio) return folio;
  if (persona) return persona;
  return dto.nombre?.trim() || "Contrato de subarrendamiento";
}

function valorCampo(
  dto: VistaPreviaPlantillaDto,
  seccion: string,
  clave: string,
): string {
  const encontrada = dto.secciones?.find((item) => item.clave === seccion);
  const campo = encontrada?.campos?.find((item) => item.clave === clave);
  const valor = campo?.valor;
  if (valor == null) return "";
  return String(valor).trim();
}

function nombreCompleto(
  ...partes: Array<string | null | undefined>
): string | null {
  const nombre = partes
    .map((parte) => (parte ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return nombre || null;
}
