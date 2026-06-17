import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { assembleArrendatarioPanel } from "src/common/arrendatario-dashboard.utils";
import { parseRangoFechas } from "src/common/pago-mensual.utils";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { Clientes } from "src/entities/Clientes";
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
    @InjectRepository(Clientes)
    private readonly clientesRepository: Repository<Clientes>,
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

  async getDashboard(fechaInicio: string, fechaFin: string) {
    const { inicio, fin } = parseRangoFechas(fechaInicio, fechaFin);

    const [idsFromArrendatarios, idsFromInmuebles] = await Promise.all([
      this.arrendatariosRepository
        .createQueryBuilder("a")
        .select("DISTINCT a.idArrendador", "idArrendador")
        .getRawMany<{ idArrendador: string }>(),
      this.inmueblesRepository
        .createQueryBuilder("i")
        .select("DISTINCT i.idArrendador", "idArrendador")
        .getRawMany<{ idArrendador: string }>(),
    ]);

    const idArrendadores = [
      ...new Set(
        [...idsFromArrendatarios, ...idsFromInmuebles]
          .map((row) => Number(row.idArrendador))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ].sort((a, b) => a - b);

    if (idArrendadores.length === 0) {
      return {
        filtros: { fechaInicio, fechaFin },
        arrendadores: [],
      };
    }

    const [arrendadores, inmuebles, arrendatarios] = await Promise.all([
      this.clientesRepository.find({
        where: { id: In(idArrendadores) },
        relations: ["sociosArrendadores"],
        order: { id: "ASC" },
      }),
      this.inmueblesRepository.find({
        where: { idArrendador: In(idArrendadores) },
        relations: ["arrendador"],
        order: { id: "ASC" },
      }),
      this.arrendatariosRepository.find({
        where: { idArrendador: In(idArrendadores) },
        relations: ["arrendador"],
        order: { id: "ASC" },
      }),
    ]);

    const idArrendatarios = arrendatarios.map((a) => a.id);
    const idInmuebles = inmuebles.map((i) => i.id);

    const [
      contratos,
      historicoPagosRenta,
      rentaActual,
      pagosArrendatarios,
      pagosInmueble,
    ] = await Promise.all([
      idArrendatarios.length > 0
        ? this.contratoRepository
            .createQueryBuilder("c")
            .leftJoinAndSelect("c.inmueble", "inmueble")
            .leftJoinAndSelect("c.contratoLocales", "contratoLocales")
            .leftJoinAndSelect("contratoLocales.local", "local")
            .leftJoinAndSelect("local.zona", "zona")
            .where("c.idArrendatario IN (:...idArrendatarios)", {
              idArrendatarios,
            })
            .andWhere(
              "(c.fechaInicioContrato IS NULL OR c.fechaInicioContrato <= :fin)",
              { fin },
            )
            .andWhere(
              "(c.fechaTerminoContrato IS NULL OR c.fechaTerminoContrato >= :inicio)",
              { inicio },
            )
            .orderBy("c.id", "DESC")
            .getMany()
        : Promise.resolve([]),
      idArrendatarios.length > 0
        ? this.historicoRepository
            .createQueryBuilder("h")
            .leftJoinAndSelect("h.contrato", "contrato")
            .leftJoinAndSelect("contrato.inmueble", "inmueble")
            .leftJoinAndSelect("h.formula", "formula")
            .where("h.idArrendatario IN (:...idArrendatarios)", {
              idArrendatarios,
            })
            .andWhere("h.mes >= :inicio", { inicio })
            .andWhere("h.mes <= :fin", { fin })
            .orderBy("h.mes", "DESC")
            .addOrderBy("h.id", "DESC")
            .getMany()
        : Promise.resolve([]),
      idArrendatarios.length > 0
        ? this.rentaActualRepository
            .createQueryBuilder("r")
            .leftJoinAndSelect("r.contrato", "contrato")
            .leftJoinAndSelect("contrato.inmueble", "inmueble")
            .leftJoinAndSelect("r.formula", "formula")
            .where("r.idArrendatario IN (:...idArrendatarios)", {
              idArrendatarios,
            })
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
      idInmuebles.length > 0
        ? this.pagoRepository
            .createQueryBuilder("p")
            .leftJoinAndSelect("p.inmueble", "inmueble")
            .leftJoinAndSelect("p.servicioInmueble", "servicioInmueble")
            .leftJoinAndSelect("servicioInmueble.tipoServicio", "tipoServicio")
            .leftJoinAndSelect("p.metodoPago", "metodoPago")
            .where("p.idInmueble IN (:...idInmuebles)", { idInmuebles })
            .andWhere("p.fechaPago >= :inicio", { inicio })
            .andWhere("p.fechaPago <= :fin", { fin })
            .orderBy("p.fechaPago", "DESC")
            .addOrderBy("p.id", "DESC")
            .getMany()
        : Promise.resolve([]),
    ]);

    const idInmueblesContratos = [
      ...new Set(
        contratos
          .map((c) => c.idInmueble)
          .filter((id): id is number => id != null),
      ),
    ];

    const [zonasRaw, localesPool] = await Promise.all([
      idInmueblesContratos.length > 0
        ? this.zonasRepository.find({
            where: { idInmueble: In(idInmueblesContratos) },
            relations: ["locales"],
            order: { numeroZona: "ASC", id: "ASC" },
          })
        : Promise.resolve([]),
      idInmueblesContratos.length > 0
        ? this.localesRepository
            .createQueryBuilder("local")
            .leftJoinAndSelect("local.zona", "zona")
            .leftJoinAndSelect("zona.inmueble", "inmueble")
            .where("zona.idInmueble IN (:...idInmueblesContratos)", {
              idInmueblesContratos,
            })
            .orderBy("local.id", "ASC")
            .getMany()
        : Promise.resolve([]),
    ]);

    const inmueblesByArrendador = this.groupBy(inmuebles, "idArrendador");
    const arrendatariosByArrendador = this.groupBy(arrendatarios, "idArrendador");
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
    const pagosInmuebleByInmueble = this.groupBy(pagosInmueble, "idInmueble");
    const zonasByInmueble = this.groupBy(zonasRaw, "idInmueble");

    const arrendadoresDashboard = arrendadores.map((arrendador) => {
      const inmueblesArrendador = inmueblesByArrendador.get(arrendador.id) ?? [];

      const pagosInmuebleArrendador = inmueblesArrendador.flatMap(
        (inmueble) => pagosInmuebleByInmueble.get(inmueble.id) ?? [],
      );

      const arrendatariosArrendador =
        arrendatariosByArrendador.get(arrendador.id) ?? [];

      const arrendatariosPanel = arrendatariosArrendador.map((arrendatario) => {
        const contratosArrendatario =
          contratosByArrendatario.get(arrendatario.id) ?? [];
        const idInmueblesArrendatario = [
          ...new Set(
            contratosArrendatario
              .map((c) => c.idInmueble)
              .filter((id): id is number => id != null),
          ),
        ];
        const zonasArrendatario = idInmueblesArrendatario.flatMap(
          (idInmueble) => zonasByInmueble.get(idInmueble) ?? [],
        );

        return assembleArrendatarioPanel(
          arrendatario,
          contratosArrendatario,
          zonasArrendatario,
          localesPool,
          historicoByArrendatario.get(arrendatario.id) ?? [],
          rentaByArrendatario.get(arrendatario.id) ?? [],
          pagosArrByArrendatario.get(arrendatario.id) ?? [],
        );
      });

      return {
        arrendador,
        inmuebles: inmueblesArrendador,
        pagosInmueble: pagosInmuebleArrendador.sort((a, b) => {
          const fa = a.fechaPago ? new Date(a.fechaPago).getTime() : 0;
          const fb = b.fechaPago ? new Date(b.fechaPago).getTime() : 0;
          return fb - fa || Number(b.id) - Number(a.id);
        }),
        arrendatarios: arrendatariosPanel,
      };
    });

    return {
      filtros: { fechaInicio, fechaFin },
      arrendadores: arrendadoresDashboard,
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
