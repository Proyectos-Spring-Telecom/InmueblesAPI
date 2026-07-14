import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ContratoEstatus } from "src/common/contrato-estatus.enum";
import { LocalesEstatus } from "src/common/locales-estatus.enum";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { ContratoLocales } from "src/entities/ContratoLocales";
import { LocalesZonaInmueble } from "src/entities/LocalesZonaInmueble";
import { DataSource, Repository } from "typeorm";

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
  ) {}

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
}
