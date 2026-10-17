import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { parseRangoFechas, parseRangoMeses, sqlMesEnRango } from "src/common/pago-mensual.utils";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Inmuebles } from "src/entities/Inmuebles";
import { Pago } from "src/entities/Pago";
import { CobranzaConsultasService } from "src/cobranza/cobranza-consultas.service";
import { ZonasInmuebles } from "src/entities/ZonasInmuebles";
import { mapInmuebleDashboardReduced } from "./inmuebles-dashboard.mapper";

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
    private readonly cobranzaConsultas: CobranzaConsultasService,
    @InjectRepository(Pago)
    private readonly pagoRepository: Repository<Pago>,
  ) {}

  async getDashboard(
    idInmueble: number,
    fechaInicio: string,
    fechaFin: string,
  ) {
    const { inicio, fin } = parseRangoFechas(fechaInicio, fechaFin);
    const { mesKeyInicio, mesKeyFin } = parseRangoMeses(fechaInicio, fechaFin);

    const inmueble = await this.inmueblesRepository.findOne({
      where: { id: idInmueble },
      relations: ["arrendador"],
    });
    if (!inmueble) {
      throw new NotFoundException(`Inmueble con id ${idInmueble} no encontrado.`);
    }

    const contratos = await this.contratoRepository
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.contratoLocales", "contratoLocales")
      .leftJoinAndSelect("contratoLocales.local", "local")
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

    const [zonasRaw, arrendatarios, rentaActual, pagosArrendatarios, pagosInmueble] =
      await Promise.all([
        this.zonasRepository.find({
          where: { idInmueble },
          relations: ["locales"],
          order: { numeroZona: "ASC", id: "ASC" },
        }),
        idArrendatarios.length > 0
          ? this.arrendatariosRepository.find({
              where: { id: In(idArrendatarios) },
              order: { id: "ASC" },
            })
          : Promise.resolve([]),
        this.cobranzaConsultas.rentasActualesDeContratos(idContratos, { mesKeyInicio, mesKeyFin }),
        this.cobranzaConsultas.serviciosDeArrendatarios(idArrendatarios, inicio, fin),
        this.pagoRepository
          .createQueryBuilder("p")
          .where("p.idInmueble = :idInmueble", { idInmueble })
          .andWhere("p.fechaPago >= :inicio", { inicio })
          .andWhere("p.fechaPago <= :fin", { fin })
          .orderBy("p.fechaPago", "DESC")
          .addOrderBy("p.id", "DESC")
          .getMany(),
      ]);

    return mapInmuebleDashboardReduced({
      inmueble,
      zonas: zonasRaw,
      contratos,
      arrendatarios,
      rentaActual,
      pagosArrendatarios,
      pagosInmueble,
    });
  }
}
