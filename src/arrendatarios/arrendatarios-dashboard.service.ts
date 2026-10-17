import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { assembleArrendatarioPanel } from "src/common/arrendatario-dashboard.utils";
import { parseRangoFechas, parseRangoMeses, sqlMesEnRango } from "src/common/pago-mensual.utils";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { LocalesZonaInmueble } from "src/entities/LocalesZonaInmueble";
import { CobranzaConsultasService } from "src/cobranza/cobranza-consultas.service";
import { ZonasInmuebles } from "src/entities/ZonasInmuebles";

@Injectable()
export class ArrendatariosDashboardService {
  constructor(
    @InjectRepository(Arrendatarios)
    private readonly arrendatariosRepository: Repository<Arrendatarios>,
    @InjectRepository(ContratoArrendatarios)
    private readonly contratoRepository: Repository<ContratoArrendatarios>,
    @InjectRepository(ZonasInmuebles)
    private readonly zonasRepository: Repository<ZonasInmuebles>,
    @InjectRepository(LocalesZonaInmueble)
    private readonly localesRepository: Repository<LocalesZonaInmueble>,
    private readonly cobranzaConsultas: CobranzaConsultasService,
  ) {}

  async getDashboard(
    idArrendatario: number,
    fechaInicio: string,
    fechaFin: string,
  ) {
    const { inicio, fin } = parseRangoFechas(fechaInicio, fechaFin);
    const { mesKeyInicio, mesKeyFin } = parseRangoMeses(fechaInicio, fechaFin);

    const arrendatario = await this.arrendatariosRepository.findOne({
      where: { id: idArrendatario },
      relations: ["arrendador"],
    });
    if (!arrendatario) {
      throw new NotFoundException(
        `Arrendatario con id ${idArrendatario} no encontrado.`,
      );
    }

    const panel = await this.buildArrendatarioPanel(
      idArrendatario,
      inicio,
      fin,
      mesKeyInicio,
      mesKeyFin,
      arrendatario,
    );

    return {
      filtros: {
        idArrendatario,
        fechaInicio,
        fechaFin,
      },
      ...panel,
    };
  }

  async buildArrendatarioPanel(
    idArrendatario: number,
    inicio: Date,
    fin: Date,
    mesKeyInicio: number,
    mesKeyFin: number,
    arrendatario: Arrendatarios,
  ) {
    const contratos = await this.contratoRepository
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.inmueble", "inmueble")
      .leftJoinAndSelect("c.contratoLocales", "contratoLocales")
      .leftJoinAndSelect("contratoLocales.local", "local")
      .leftJoinAndSelect("local.zona", "zona")
      .where("c.idArrendatario = :idArrendatario", { idArrendatario })
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

    const idInmuebles = [
      ...new Set(
        contratos
          .map((c) => c.idInmueble)
          .filter((id): id is number => id != null),
      ),
    ];

    const [zonasRaw, localesPool, historicoPagosRenta, rentaActual, pagosArrendatarios] =
      await Promise.all([
        idInmuebles.length > 0
          ? this.zonasRepository.find({
              where: { idInmueble: In(idInmuebles) },
              relations: ["locales"],
              order: { numeroZona: "ASC", id: "ASC" },
            })
          : Promise.resolve([]),
        idInmuebles.length > 0
          ? (() => {
              const localIds = this.collectLocalIds(contratos);
              return localIds.length > 0
                ? this.localesRepository.find({
                    where: { id: In(localIds) },
                    relations: ["zona", "zona.inmueble"],
                    order: { id: "ASC" },
                  })
                : Promise.resolve([]);
            })()
          : Promise.resolve([]),
        // Histórico = cargos de renta liquidados; renta actual = pendientes o parciales.
        this.cobranzaConsultas.rentasDeArrendatario(idArrendatario, { mesKeyInicio, mesKeyFin }, 1),
        this.cobranzaConsultas.rentasDeArrendatario(idArrendatario, { mesKeyInicio, mesKeyFin }, 0),
        this.cobranzaConsultas.serviciosDeArrendatarios([idArrendatario], inicio, fin),
      ]);

    return assembleArrendatarioPanel(
      arrendatario,
      contratos,
      zonasRaw,
      localesPool,
      historicoPagosRenta,
      rentaActual,
      pagosArrendatarios,
    );
  }

  private collectLocalIds(contratos: ContratoArrendatarios[]): number[] {
    const ids = new Set<number>();
    for (const contrato of contratos) {
      for (const cl of contrato.contratoLocales ?? []) {
        if (cl.idLocal != null) {
          ids.add(Number(cl.idLocal));
        }
      }
    }
    return [...ids];
  }
}
