import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { getMesActual, sqlMesEnRango } from "src/common/pago-mensual.utils";
import { Cargos } from "src/entities/Cargos";
import { Pagos } from "src/entities/Pagos";
import {
  CARGO_SERVICIO_RELATIONS,
  pagoReferencia,
  RentaLegacy,
  toPagoServicioLegacy,
  toRentaLegacy,
} from "./cobranza-legacy";

export type PagoServicioLegacy = ReturnType<typeof toPagoServicioLegacy>;

/** Lecturas de cargos con la forma del modelo anterior, para dashboards y notificaciones. */
@Injectable()
export class CobranzaConsultasService {
  constructor(
    @InjectRepository(Cargos)
    private readonly cargosRepository: Repository<Cargos>,
    @InjectRepository(Pagos)
    private readonly pagosRepository: Repository<Pagos>,
  ) {}

  /**
   * Cargos de renta de un arrendatario cuyo mes cae en el rango.
   * `liquidado` 1 = histórico (pagados), 0 = pendientes o parciales; sin valor = todos.
   */
  async rentasDeArrendatario(
    idArrendatario: number,
    rango: { mesKeyInicio: number; mesKeyFin: number },
    liquidado?: 0 | 1,
  ): Promise<RentaLegacy[]> {
    const qb = this.baseRentas()
      .andWhere("c.idArrendatario = :idArrendatario", { idArrendatario })
      .andWhere(sqlMesEnRango("c.mes"), rango);
    if (liquidado !== undefined) qb.andWhere("c.liquidado = :liquidado", { liquidado });
    return (await qb.orderBy("c.mes", "DESC").addOrderBy("c.id", "DESC").getMany()).map(toRentaLegacy);
  }

  /**
   * "Renta actual" de varios contratos en el rango: pendientes o parciales, más los del mes en
   * curso aunque estén pagados (mismo universo que la tabla RentaActual del modelo anterior).
   */
  async rentasActualesDeContratos(
    idContratos: number[],
    rango: { mesKeyInicio: number; mesKeyFin: number },
  ): Promise<RentaLegacy[]> {
    if (idContratos.length === 0) return [];
    const mesActual = getMesActual();
    return (
      await this.baseRentas()
        .andWhere("c.idContrato IN (:...idContratos)", { idContratos })
        .andWhere(sqlMesEnRango("c.mes"), rango)
        .andWhere("(c.liquidado = 0 OR (YEAR(c.mes) = :anio AND MONTH(c.mes) = :mesNum))", {
          anio: mesActual.getFullYear(),
          mesNum: mesActual.getMonth() + 1,
        })
        .orderBy("c.mes", "DESC")
        .addOrderBy("c.id", "DESC")
        .getMany()
    ).map(toRentaLegacy);
  }

  /** Cargos de servicio de arrendatarios con fecha en el rango, con forma de PagosArrendatarios. */
  async serviciosDeArrendatarios(
    idArrendatarios: number[],
    inicio: Date,
    fin: Date,
  ): Promise<PagoServicioLegacy[]> {
    if (idArrendatarios.length === 0) return [];
    const cargos = await this.cargosRepository
      .createQueryBuilder("c")
      .where("c.clase = 'SERVICIO'")
      .andWhere("c.idArrendatario IN (:...idArrendatarios)", { idArrendatarios })
      .andWhere("c.mes >= :inicio AND c.mes <= :fin", { inicio, fin })
      .orderBy("c.mes", "DESC")
      .addOrderBy("c.id", "DESC")
      .select("c.id")
      .getMany();
    const ids = cargos.map((c) => Number(c.id));
    if (ids.length === 0) return [];
    const [completos, pagos] = await Promise.all([
      this.cargosRepository.find({ where: { id: In(ids) }, relations: [...CARGO_SERVICIO_RELATIONS] }),
      this.pagosRepository.find({ where: { idCargoReferencia: In(ids) }, relations: ["metodoPago"] }),
    ]);
    const porId = new Map(completos.map((c) => [Number(c.id), c]));
    return ids
      .map((id) => porId.get(id))
      .filter((c): c is Cargos => !!c)
      .map((c) =>
        toPagoServicioLegacy(c, pagoReferencia(pagos.filter((p) => Number(p.idCargoReferencia) === Number(c.id)))),
      );
  }

  private baseRentas() {
    return this.cargosRepository
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.contrato", "contrato")
      .leftJoinAndSelect("contrato.inmueble", "inmueble")
      .leftJoinAndSelect("c.formula", "formula")
      .leftJoinAndSelect("c.conceptos", "conceptos")
      .where("c.clase = 'RENTA' AND c.estatus = 1");
  }
}
