import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import {
  assembleArrendatarioPanel,
  collectLocalesAsignados,
  filterZonasConLocales,
} from "src/common/arrendatario-dashboard.utils";
import { parseRangoFechas } from "src/common/pago-mensual.utils";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { HistoricoPagosRenta } from "src/entities/HistoricoPagosRenta";
import { Inmuebles } from "src/entities/Inmuebles";
import { LocalesZonaInmueble } from "src/entities/LocalesZonaInmueble";
import { Pago } from "src/entities/Pago";
import { PagosArrendatarios } from "src/entities/PagosArrendatarios";
import { RentaActual } from "src/entities/RentaActual";
import { ZonasInmuebles } from "src/entities/ZonasInmuebles";

@Injectable()
export class InmueblesDashboardService {
  constructor(
    @InjectRepository(Inmuebles)
    private readonly inmueblesRepository: Repository<Inmuebles>,
    @InjectRepository(Arrendatarios)
    private readonly arrendatariosRepository: Repository<Arrendatarios>,
    @InjectRepository(ContratoArrendatarios)
    private readonly contratoRepository: Repository<ContratoArrendatarios>,
    @InjectRepository(ZonasInmuebles)
    private readonly zonasRepository: Repository<ZonasInmuebles>,
    @InjectRepository(LocalesZonaInmueble)
    private readonly localesRepository: Repository<LocalesZonaInmueble>,
    @InjectRepository(HistoricoPagosRenta)
    private readonly historicoRepository: Repository<HistoricoPagosRenta>,
    @InjectRepository(RentaActual)
    private readonly rentaActualRepository: Repository<RentaActual>,
    @InjectRepository(PagosArrendatarios)
    private readonly pagosArrendatariosRepository: Repository<PagosArrendatarios>,
    @InjectRepository(Pago)
    private readonly pagoRepository: Repository<Pago>,
  ) {}

  async getDashboard(
    idInmueble: number,
    fechaInicio: string,
    fechaFin: string,
  ) {
    const { inicio, fin } = parseRangoFechas(fechaInicio, fechaFin);

    const inmueble = await this.inmueblesRepository.findOne({
      where: { id: idInmueble },
      relations: ["arrendador", "arrendador.sociosArrendadores"],
    });
    if (!inmueble) {
      throw new NotFoundException(`Inmueble con id ${idInmueble} no encontrado.`);
    }

    const contratos = await this.contratoRepository
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.inmueble", "inmueble")
      .leftJoinAndSelect("c.arrendatario", "arrendatario")
      .leftJoinAndSelect("c.contratoLocales", "contratoLocales")
      .leftJoinAndSelect("contratoLocales.local", "local")
      .leftJoinAndSelect("local.zona", "zona")
      .where("c.idInmueble = :idInmueble", { idInmueble })
      .andWhere(
        "(c.fechaInicioContrato IS NULL OR c.fechaInicioContrato <= :fin)",
        { fin },
      )
      .andWhere(
        "(c.fechaTerminoContrato IS NULL OR c.fechaTerminoContrato >= :inicio)",
        { inicio },
      )
      .orderBy("c.id", "DESC")
      .getMany();

    const idArrendatarios = [
      ...new Set(
        contratos
          .map((c) => c.idArrendatario)
          .filter((id): id is number => id != null),
      ),
    ];
    const idContratos = contratos.map((c) => c.id);
    const idLocalesAsignados = collectLocalesAsignados(contratos);
    const localIds = [...idLocalesAsignados];

    const [
      zonasRaw,
      localesPool,
      arrendatarios,
      historicoPagosRenta,
      rentaActual,
      pagosArrendatarios,
      pagosInmueble,
    ] = await Promise.all([
      this.zonasRepository.find({
        where: { idInmueble },
        relations: ["locales"],
        order: { numeroZona: "ASC", id: "ASC" },
      }),
      localIds.length > 0
        ? this.localesRepository.find({
            where: { id: In(localIds) },
            relations: ["zona", "zona.inmueble"],
            order: { id: "ASC" },
          })
        : Promise.resolve([]),
      idArrendatarios.length > 0
        ? this.arrendatariosRepository.find({
            where: { id: In(idArrendatarios) },
            relations: ["arrendador"],
            order: { id: "ASC" },
          })
        : Promise.resolve([]),
      idContratos.length > 0
        ? this.historicoRepository
            .createQueryBuilder("h")
            .leftJoinAndSelect("h.contrato", "contrato")
            .leftJoinAndSelect("contrato.inmueble", "inmueble")
            .leftJoinAndSelect("h.formula", "formula")
            .where("h.idContrato IN (:...idContratos)", { idContratos })
            .andWhere("h.mes >= :inicio", { inicio })
            .andWhere("h.mes <= :fin", { fin })
            .orderBy("h.mes", "DESC")
            .addOrderBy("h.id", "DESC")
            .getMany()
        : Promise.resolve([]),
      idContratos.length > 0
        ? this.rentaActualRepository
            .createQueryBuilder("r")
            .leftJoinAndSelect("r.contrato", "contrato")
            .leftJoinAndSelect("contrato.inmueble", "inmueble")
            .leftJoinAndSelect("r.formula", "formula")
            .where("r.idContrato IN (:...idContratos)", { idContratos })
            .andWhere("r.mes >= :inicio", { inicio })
            .andWhere("r.mes <= :fin", { fin })
            .orderBy("r.mes", "DESC")
            .addOrderBy("r.id", "DESC")
            .getMany()
        : Promise.resolve([]),
      idArrendatarios.length > 0
        ? this.pagosArrendatariosRepository
            .createQueryBuilder("p")
            .leftJoinAndSelect("p.servicioArrendatario", "servicioArrendatario")
            .leftJoinAndSelect(
              "servicioArrendatario.tipoServicio",
              "tipoServicio",
            )
            .leftJoinAndSelect("p.metodoPago", "metodoPago")
            .where("p.idArrendatario IN (:...idArrendatarios)", {
              idArrendatarios,
            })
            .andWhere("p.fechaPago >= :inicio", { inicio })
            .andWhere("p.fechaPago <= :fin", { fin })
            .orderBy("p.fechaPago", "DESC")
            .addOrderBy("p.id", "DESC")
            .getMany()
        : Promise.resolve([]),
      this.pagoRepository
        .createQueryBuilder("p")
        .leftJoinAndSelect("p.inmueble", "inmueble")
        .leftJoinAndSelect("p.servicioInmueble", "servicioInmueble")
        .leftJoinAndSelect("servicioInmueble.tipoServicio", "tipoServicio")
        .leftJoinAndSelect("p.metodoPago", "metodoPago")
        .where("p.idInmueble = :idInmueble", { idInmueble })
        .andWhere("p.fechaPago >= :inicio", { inicio })
        .andWhere("p.fechaPago <= :fin", { fin })
        .orderBy("p.fechaPago", "DESC")
        .addOrderBy("p.id", "DESC")
        .getMany(),
    ]);

    const zonas = filterZonasConLocales(zonasRaw, idLocalesAsignados);
    const locales = localesPool
      .filter((local) => idLocalesAsignados.has(local.id))
      .sort((a, b) => a.id - b.id);

    const contratosByArrendatario = this.groupBy(contratos, "idArrendatario");
    const historicoByArrendatario = this.groupBy(
      historicoPagosRenta,
      "idArrendatario",
    );
    const rentaByArrendatario = this.groupBy(rentaActual, "idArrendatario");
    const pagosArrByArrendatario = this.groupBy(
      pagosArrendatarios,
      "idArrendatario",
    );

    const arrendatariosPanel = arrendatarios.map((arrendatario) =>
      assembleArrendatarioPanel(
        arrendatario,
        contratosByArrendatario.get(arrendatario.id) ?? [],
        zonasRaw,
        localesPool,
        historicoByArrendatario.get(arrendatario.id) ?? [],
        rentaByArrendatario.get(arrendatario.id) ?? [],
        pagosArrByArrendatario.get(arrendatario.id) ?? [],
      ),
    );

    return {
      filtros: {
        idInmueble,
        fechaInicio,
        fechaFin,
      },
      inmueble,
      arrendador: inmueble.arrendador ?? null,
      zonas,
      locales,
      pagosInmueble,
      arrendatarios: arrendatariosPanel,
    };
  }

  private groupBy<T, K extends keyof T>(
    items: T[],
    key: K,
  ): Map<NonNullable<T[K]>, T[]> {
    const map = new Map<NonNullable<T[K]>, T[]>();
    for (const item of items) {
      const groupKey = item[key];
      if (groupKey == null) continue;
      const bucket = map.get(groupKey as NonNullable<T[K]>);
      if (bucket) {
        bucket.push(item);
      } else {
        map.set(groupKey as NonNullable<T[K]>, [item]);
      }
    }
    return map;
  }
}
