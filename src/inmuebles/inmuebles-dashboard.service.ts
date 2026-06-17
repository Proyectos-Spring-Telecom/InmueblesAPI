import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { parseRangoFechas } from "src/common/pago-mensual.utils";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Inmuebles } from "src/entities/Inmuebles";
import { Pago } from "src/entities/Pago";
import { PagosArrendatarios } from "src/entities/PagosArrendatarios";
import { RentaActual } from "src/entities/RentaActual";
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
        idContratos.length > 0
          ? this.rentaActualRepository
              .createQueryBuilder("r")
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
