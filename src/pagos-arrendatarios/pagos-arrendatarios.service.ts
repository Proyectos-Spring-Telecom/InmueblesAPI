import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ApiResponseCommon } from "src/common/ApiResponse";
import { assertArrendatarioConContratoActivo } from "src/common/contrato-validation";
import { PagoEstatus } from "src/common/pago-estatus.enum";
import { parseRangoFechas } from "src/common/pago-mensual.utils";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { CatMetodosPago } from "src/entities/CatMetodosPago";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { ServiciosArrendatarios } from "src/entities/ServiciosArrendatarios";
import { S3Service } from "src/s3/s3.service";
import { DataSource, In, Repository } from "typeorm";
import {
  CARGO_SERVICIO_RELATIONS,
  pagoReferencia,
  toPagoServicioLegacy,
} from "src/cobranza/cobranza-legacy";
import { CobranzaService } from "src/cobranza/cobranza.service";
import { cents } from "src/cobranza/money";
import { Cargos } from "src/entities/Cargos";
import { PagoRecibidoEstatus, Pagos } from "src/entities/Pagos";
import { getClienteHijos, isSuperAdmin } from "src/utils/cliente-utils";
import { CreatePagosArrendatarioDto } from "./dto/create-pagos-arrendatario.dto";

const FOLDER_COMPROBANTE = "ComprobantesPagoArrendatarios";
const ID_MODULE = 1;


export interface PagosArrendatariosFilters {
  fechaInicio: string;
  fechaFin: string;
  idArrendatario?: number;
}

@Injectable()
export class PagosArrendatariosService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Cargos)
    private readonly cargosRepository: Repository<Cargos>,
    @InjectRepository(Pagos)
    private readonly pagosRepository: Repository<Pagos>,
    @InjectRepository(Arrendatarios)
    private readonly arrendatariosRepository: Repository<Arrendatarios>,
    @InjectRepository(ContratoArrendatarios)
    private readonly contratoRepository: Repository<ContratoArrendatarios>,
    @InjectRepository(ServiciosArrendatarios)
    private readonly serviciosArrendatariosRepository: Repository<ServiciosArrendatarios>,
    @InjectRepository(CatMetodosPago)
    private readonly catMetodosPagoRepository: Repository<CatMetodosPago>,
    private readonly s3Service: S3Service,
    private readonly cobranza: CobranzaService,
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

    await assertArrendatarioConContratoActivo(
      this.contratoRepository,
      dto.idArrendatario,
    );

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

    const fechaPagoFinal =
      dto.fechaPagoFinal != null && String(dto.fechaPagoFinal).trim() !== ""
        ? new Date(dto.fechaPagoFinal)
        : null;
    const fechaPago = new Date(dto.fechaPago);
    const estatus = dto.estatus ?? PagoEstatus.Pagado;
    const servicio =
      dto.idServicioArrendatario != null
        ? await this.serviciosArrendatariosRepository.findOne({ where: { id: dto.idServicioArrendatario } })
        : null;
    const metodo =
      dto.idMetodoPago != null
        ? await this.catMetodosPagoRepository.findOne({ where: { id: dto.idMetodoPago } })
        : null;

    // Modelo de cargos: el servicio es un cargo y el registro de pago es un pago (con su comprobante).
    // Pagado → pago confirmado y aplicado; Pendiente → pago por confirmar; Cancelado → todo cancelado.
    const idCargo = await this.dataSource.transaction(async (m) => {
      const id = await this.cobranza.crearCargo(m, {
        idArrendatario: dto.idArrendatario,
        idContrato: servicio?.idContrato ?? null,
        clase: "SERVICIO",
        mes: fechaPago,
        fechaFin: fechaPagoFinal,
        descripcion: dto.concepto ?? null,
        origen: "SERVICIO",
        idUsuario: idUser,
        conceptos: [
          {
            tipo: "SERVICIO",
            montoBase: dto.monto,
            idTipoServicio: servicio?.idTipoServicio ?? null,
            idServicioArrendatario: dto.idServicioArrendatario ?? null,
            descripcion: dto.concepto ?? null,
          },
        ],
      });
      const [concepto] = await m.query(`SELECT Id FROM CargoConceptos WHERE IdCargo = ? LIMIT 1`, [id]);
      const idPago = await this.cobranza.registrarPago(
        m,
        {
          idArrendatario: dto.idArrendatario,
          fechaPago,
          fechaPagoFinal,
          monto: dto.monto,
          idMetodoPago: dto.idMetodoPago ?? null,
          formaPagoSat: metodo?.formaPagoSat ?? null,
          concepto: dto.concepto ?? null,
          comprobanteUrl: upload.url,
          idCargoReferencia: id,
          origen: "CAPTURA",
          estatus:
            estatus === PagoEstatus.Pagado ? PagoRecibidoEstatus.Confirmado : PagoRecibidoEstatus.PorConfirmar,
          idUsuario: idUser,
        },
        estatus === PagoEstatus.Pagado ? [{ idCargoConcepto: Number(concepto.Id), monto: dto.monto }] : [],
      );
      if (estatus === PagoEstatus.Cancelado) {
        await this.cobranza.cancelarPago(m, idPago, null, idUser);
        await m.update(Cargos, id, { estatus: 0 });
      }
      return id;
    });

    return this.findOne(idCargo);
  }

  async findOne(id: number) {
    const data = await this.cargosRepository.findOne({
      where: { id, clase: "SERVICIO" },
      relations: [...CARGO_SERVICIO_RELATIONS],
    });
    if (!data) {
      throw new NotFoundException(`Pago de arrendatario con id ${id} no encontrado`);
    }
    const pagos = await this.pagosRepository.find({ where: { idCargoReferencia: id }, relations: ["metodoPago"] });
    return toPagoServicioLegacy(data, pagoReferencia(pagos));
  }

  /**
   * Compatibilidad del cambio de estatus:
   * 1 Pagado → confirma el pago registrado (o registra uno por el saldo) y lo aplica;
   * 2 Pendiente → el pago vuelve a "por confirmar" y deja de aplicarse;
   * 0 Cancelado → cancela el pago y el cargo.
   */
  async updateEstatus(id: number, estatus: PagoEstatus, idUser: number | null = null) {
    const cargo = await this.cargosRepository.findOne({ where: { id, clase: "SERVICIO" } });
    if (!cargo) {
      throw new NotFoundException(`Pago de arrendatario con id ${id} no encontrado`);
    }

    await this.dataSource.transaction(async (m) => {
      const pagos = await m.find(Pagos, { where: { idCargoReferencia: id } });
      const noCancelados = pagos.filter((p) => Number(p.estatus) !== PagoRecibidoEstatus.Cancelado);

      if (estatus === PagoEstatus.Cancelado) {
        for (const p of noCancelados) await this.cobranza.cancelarPago(m, Number(p.id), null, idUser);
        await m.update(Cargos, id, { estatus: 0 });
        await this.cobranza.recalcularCargo(m, id);
        return;
      }

      await m.update(Cargos, id, { estatus: 1 });
      if (estatus === PagoEstatus.Pendiente) {
        for (const p of noCancelados) {
          await this.cobranza.cambiarEstatusPago(m, Number(p.id), PagoRecibidoEstatus.PorConfirmar, idUser);
        }
        await this.cobranza.recalcularCargo(m, id);
        return;
      }

      // Pagado: confirmar el pago registrado y aplicarlo hasta cubrir el saldo.
      await this.cobranza.recalcularCargo(m, id);
      for (const p of noCancelados) {
        if (Number(p.estatus) === PagoRecibidoEstatus.PorConfirmar) {
          await this.cobranza.cambiarEstatusPago(m, Number(p.id), PagoRecibidoEstatus.Confirmado, idUser);
        }
        const [concepto] = await m.query(
          `SELECT Id, Saldo FROM CargoConceptos WHERE IdCargo = ? AND Estatus = 1 LIMIT 1`,
          [id],
        );
        const [pago] = await m.query(`SELECT Disponible FROM Pagos WHERE Id = ?`, [p.id]);
        const monto = Math.min(cents(concepto?.Saldo), cents(pago?.Disponible));
        if (concepto && monto > 0) {
          await this.cobranza.aplicar(m, Number(p.id), [{ idCargoConcepto: Number(concepto.Id), monto: monto / 100 }], idUser);
        }
      }
      const actualizado = await m.findOne(Cargos, { where: { id } });
      if (actualizado && Number(actualizado.liquidado) !== 1) {
        await this.cobranza.liquidarCargo(m, id, { idUsuario: idUser, origen: "CAPTURA" });
      }
    });

    return {
      status: "success",
      message: "Estatus del pago de arrendatario actualizado correctamente.",
      data: await this.findOne(id),
    };
  }

  async findAllPaginated(
    page: number,
    limit: number,
    filters: PagosArrendatariosFilters,
    idCliente: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const skip = (safePage - 1) * safeLimit;
    const { inicio, fin } = parseRangoFechas(
      filters.fechaInicio,
      filters.fechaFin,
    );

    let arrendadorIds: number[] | null = null;
    if (!isSuperAdmin(rol)) {
      const scope = await getClienteHijos(
        this.arrendatariosRepository,
        idCliente,
      );
      if (scope.ids.length === 0) {
        return {
          data: [],
          paginated: {
            total: 0,
            page: safePage,
            lastPage: 0,
          },
        };
      }
      arrendadorIds = scope.ids;
    }

    const qb = this.cargosRepository
      .createQueryBuilder("c")
      .leftJoin("c.arrendatario", "arrendatario")
      .where("c.clase = 'SERVICIO'")
      .andWhere("c.mes >= :inicio", { inicio })
      .andWhere("c.mes <= :fin", { fin });

    if (arrendadorIds) {
      qb.andWhere("arrendatario.idArrendador IN (:...arrendadorIds)", {
        arrendadorIds,
      });
    }

    if (filters.idArrendatario != null) {
      qb.andWhere("c.idArrendatario = :idArrendatario", {
        idArrendatario: filters.idArrendatario,
      });
    }

    const total = await qb.getCount();
    const idRows = await qb
      .select("c.id", "id")
      .orderBy("c.mes", "DESC")
      .addOrderBy("c.id", "DESC")
      .skip(skip)
      .take(safeLimit)
      .getRawMany<{ id: string }>();
    const ids = idRows.map((r) => Number(r.id));

    const cargos = ids.length
      ? await this.cargosRepository.find({ where: { id: In(ids) }, relations: [...CARGO_SERVICIO_RELATIONS] })
      : [];
    const pagos = ids.length
      ? await this.pagosRepository.find({ where: { idCargoReferencia: In(ids) }, relations: ["metodoPago"] })
      : [];
    const porId = new Map(cargos.map((c) => [Number(c.id), c]));
    const data = ids
      .map((id) => porId.get(id))
      .filter((c): c is Cargos => !!c)
      .map((c) =>
        toPagoServicioLegacy(c, pagoReferencia(pagos.filter((p) => Number(p.idCargoReferencia) === Number(c.id)))),
      );

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
