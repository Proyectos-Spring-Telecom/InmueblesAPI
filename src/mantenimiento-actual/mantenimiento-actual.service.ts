import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { ApiResponseCommon } from "src/common/ApiResponse";
import {
  decStr,
  getMesActual,
  PAGO_MENSUAL_RELATIONS,
} from "src/common/pago-mensual.utils";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Formulas } from "src/entities/Formulas";
import { HistoricoPagosMantenimiento } from "src/entities/HistoricoPagosMantenimiento";
import { MantenimientoActual } from "src/entities/MantenimientoActual";
import { CreateMantenimientoActualDto } from "./dto/create-mantenimiento-actual.dto";
import { UpdateMantenimientoActualDto } from "./dto/update-mantenimiento-actual.dto";

@Injectable()
export class MantenimientoActualService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(MantenimientoActual)
    private readonly mantenimientoRepository: Repository<MantenimientoActual>,
    @InjectRepository(Arrendatarios)
    private readonly arrendatariosRepository: Repository<Arrendatarios>,
    @InjectRepository(ContratoArrendatarios)
    private readonly contratoRepository: Repository<ContratoArrendatarios>,
    @InjectRepository(Formulas)
    private readonly formulasRepository: Repository<Formulas>,
  ) {}

  async create(dto: CreateMantenimientoActualDto) {
    await this.assertArrendatario(dto.idArrendatario);
    await this.assertContrato(dto.idContrato, dto.idArrendatario);
    await this.assertFormula(dto.idFormula);
    await this.assertNoRegistroActivo(dto.idArrendatario, dto.idContrato);

    const row = this.mantenimientoRepository.create({
      idArrendatario: dto.idArrendatario,
      idContrato: dto.idContrato,
      mes: getMesActual(),
      total: decStr(dto.total),
      idFormula: dto.idFormula ?? null,
      montoFinal: decStr(dto.montoFinal),
      factorVariable: decStr(dto.factorVariable),
      ocupoFormula: dto.ocupoFormula ?? null,
      pagada: 0,
    });

    const saved = await this.mantenimientoRepository.save(row);
    return {
      status: "success",
      message: "Mantenimiento actual registrado correctamente.",
      data: await this.findOne(Number(saved.id)),
    };
  }

  async update(id: number, dto: UpdateMantenimientoActualDto) {
    const current = await this.mantenimientoRepository.findOne({
      where: { id },
    });
    if (!current) {
      throw new NotFoundException(
        `Mantenimiento actual con id ${id} no encontrado.`,
      );
    }

    if (dto.idFormula !== undefined) {
      await this.assertFormula(dto.idFormula);
    }

    await this.mantenimientoRepository.update(id, {
      ...(dto.total !== undefined && { total: decStr(dto.total) }),
      ...(dto.idFormula !== undefined && {
        idFormula: dto.idFormula ?? null,
      }),
      ...(dto.montoFinal !== undefined && {
        montoFinal: decStr(dto.montoFinal),
      }),
      ...(dto.factorVariable !== undefined && {
        factorVariable: decStr(dto.factorVariable),
      }),
      ...(dto.ocupoFormula !== undefined && {
        ocupoFormula: dto.ocupoFormula ?? null,
      }),
    });

    return {
      status: "success",
      message: "Mantenimiento actual actualizado correctamente.",
      data: await this.findOne(id),
    };
  }

  async marcarPagada(id: number) {
    return this.dataSource.transaction(async (manager) => {
      const row = await manager.findOne(MantenimientoActual, { where: { id } });
      if (!row) {
        throw new NotFoundException(
          `Mantenimiento actual con id ${id} no encontrado.`,
        );
      }

      const historico = manager.create(HistoricoPagosMantenimiento, {
        idArrendatario: row.idArrendatario,
        idContrato: row.idContrato,
        mes: row.mes,
        total: row.total,
        idFormula: row.idFormula,
        montoFinal: row.montoFinal,
        factorVariable: row.factorVariable,
        ocupoFormula: row.ocupoFormula,
        pagada: 1,
      });
      const saved = await manager.save(HistoricoPagosMantenimiento, historico);
      await manager.delete(MantenimientoActual, id);

      const data = await manager.findOne(HistoricoPagosMantenimiento, {
        where: { id: saved.id },
        relations: [...PAGO_MENSUAL_RELATIONS],
      });

      return {
        status: "success",
        message:
          "Mantenimiento marcado como pagado y movido al histórico correctamente.",
        data,
      };
    });
  }

  async findOne(id: number) {
    const data = await this.mantenimientoRepository.findOne({
      where: { id },
      relations: [...PAGO_MENSUAL_RELATIONS],
    });
    if (!data) {
      throw new NotFoundException(
        `Mantenimiento actual con id ${id} no encontrado.`,
      );
    }
    return data;
  }

  async findAllPaginated(
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const skip = (safePage - 1) * safeLimit;

    const [idRows, total] = await this.mantenimientoRepository.findAndCount({
      select: ["id"],
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
    const data = await this.mantenimientoRepository.find({
      where: { id: In(ids) },
      relations: [...PAGO_MENSUAL_RELATIONS],
      order: { id: "DESC" },
    });

    return {
      data,
      paginated: {
        total,
        page: safePage,
        lastPage: Math.ceil(total / safeLimit),
      },
    };
  }

  private async assertNoRegistroActivo(
    idArrendatario: number,
    idContrato: number,
  ) {
    const existing = await this.mantenimientoRepository.findOne({
      where: { idArrendatario, idContrato },
      select: ["id"],
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un mantenimiento actual activo para el arrendatario ${idArrendatario} y contrato ${idContrato}.`,
      );
    }
  }

  private async assertArrendatario(idArrendatario: number) {
    const row = await this.arrendatariosRepository.findOne({
      where: { id: idArrendatario },
      select: ["id"],
    });
    if (!row) {
      throw new NotFoundException(
        `Arrendatario con id ${idArrendatario} no encontrado.`,
      );
    }
  }

  private async assertContrato(idContrato: number, idArrendatario: number) {
    const contrato = await this.contratoRepository.findOne({
      where: { id: idContrato },
      select: ["id", "idArrendatario"],
    });
    if (!contrato) {
      throw new NotFoundException(`Contrato con id ${idContrato} no encontrado.`);
    }
    if (Number(contrato.idArrendatario) !== idArrendatario) {
      throw new BadRequestException(
        `El contrato ${idContrato} no pertenece al arrendatario ${idArrendatario}.`,
      );
    }
  }

  private async assertFormula(idFormula: number | undefined) {
    if (idFormula == null) return;

    const formula = await this.formulasRepository.findOne({
      where: { id: idFormula },
      select: ["id"],
    });
    if (!formula) {
      throw new NotFoundException(`Fórmula con id ${idFormula} no encontrada.`);
    }
  }
}
