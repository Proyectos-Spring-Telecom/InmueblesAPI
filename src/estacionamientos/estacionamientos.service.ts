import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EstacionamientoEstatus } from "src/common/estacionamiento-estatus.enum";
import { Arrendatarios } from "src/entities/Arrendatarios";
import { Estacionamientos } from "src/entities/Estacionamientos";
import { Inmuebles } from "src/entities/Inmuebles";
import { Repository } from "typeorm";
import { CreateEstacionamientoDto } from "./dto/create-estacionamiento.dto";
import { UpdateEstacionamientoDto } from "./dto/update-estacionamiento.dto";

const LIST_RELATIONS = ["inmueble", "arrendatario"];

@Injectable()
export class EstacionamientosService {
  constructor(
    @InjectRepository(Estacionamientos)
    private readonly estacionamientosRepository: Repository<Estacionamientos>,
    @InjectRepository(Inmuebles)
    private readonly inmueblesRepository: Repository<Inmuebles>,
    @InjectRepository(Arrendatarios)
    private readonly arrendatariosRepository: Repository<Arrendatarios>,
  ) {}

  async create(dto: CreateEstacionamientoDto) {
    await this.assertInmuebleExists(dto.idInmueble);
    if (dto.idArrendatario != null) {
      await this.assertArrendatarioExists(dto.idArrendatario);
    }

    const row = this.estacionamientosRepository.create({
      idInmueble: dto.idInmueble,
      nombrePensionado: dto.nombrePensionado ?? null,
      numeroTarjeta: dto.numeroTarjeta ?? null,
      idArrendatario: dto.idArrendatario ?? null,
      estatus: EstacionamientoEstatus.Activo,
    });
    const saved = await this.estacionamientosRepository.save(row);

    return {
      status: "success",
      message: "Estacionamiento registrado correctamente.",
      data: await this.findOne(Number(saved.id)),
    };
  }

  async update(id: number, dto: UpdateEstacionamientoDto) {
    await this.findOne(id);

    if (dto.idInmueble != null) {
      await this.assertInmuebleExists(dto.idInmueble);
    }
    if (dto.idArrendatario != null) {
      await this.assertArrendatarioExists(dto.idArrendatario);
    }

    const patch = this.buildPatch(dto);
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException("No se enviaron campos para actualizar.");
    }

    await this.estacionamientosRepository.update(id, patch);

    return {
      status: "success",
      message: "Estacionamiento actualizado correctamente.",
      data: await this.findOne(id),
    };
  }

  async updateEstatus(id: number, estatus: EstacionamientoEstatus) {
    await this.findOne(id);
    await this.estacionamientosRepository.update(id, { estatus });

    const message =
      estatus === EstacionamientoEstatus.Baja
        ? "Estacionamiento dado de baja correctamente."
        : "Estacionamiento activado correctamente.";

    return {
      status: "success",
      message,
      data: await this.findOne(id),
    };
  }

  async desactivar(id: number) {
    return this.updateEstatus(id, EstacionamientoEstatus.Baja);
  }

  async activar(id: number) {
    return this.updateEstatus(id, EstacionamientoEstatus.Activo);
  }

  async findByIdInmueble(idInmueble: number): Promise<Estacionamientos[]> {
    await this.assertInmuebleExists(idInmueble);
    return this.estacionamientosRepository.find({
      where: { idInmueble },
      relations: LIST_RELATIONS,
      order: { id: "DESC" },
    });
  }

  async findByIdArrendatario(
    idArrendatario: number,
  ): Promise<Estacionamientos[]> {
    await this.assertArrendatarioExists(idArrendatario);
    return this.estacionamientosRepository.find({
      where: { idArrendatario },
      relations: LIST_RELATIONS,
      order: { id: "DESC" },
    });
  }

  async findOne(id: number): Promise<Estacionamientos> {
    const row = await this.estacionamientosRepository.findOne({
      where: { id },
      relations: LIST_RELATIONS,
    });
    if (!row) {
      throw new NotFoundException(
        `Estacionamiento con id ${id} no encontrado.`,
      );
    }
    return row;
  }

  private buildPatch(
    dto: UpdateEstacionamientoDto,
  ): Partial<Estacionamientos> {
    const patch: Partial<Estacionamientos> = {};
    if (dto.idInmueble !== undefined) {
      patch.idInmueble = dto.idInmueble;
    }
    if (dto.nombrePensionado !== undefined) {
      patch.nombrePensionado = dto.nombrePensionado ?? null;
    }
    if (dto.numeroTarjeta !== undefined) {
      patch.numeroTarjeta = dto.numeroTarjeta ?? null;
    }
    if (dto.idArrendatario !== undefined) {
      patch.idArrendatario = dto.idArrendatario ?? null;
    }
    return patch;
  }

  private async assertInmuebleExists(idInmueble: number): Promise<void> {
    const inmueble = await this.inmueblesRepository.findOne({
      where: { id: idInmueble },
      select: ["id"],
    });
    if (!inmueble) {
      throw new NotFoundException(
        `Inmueble con id ${idInmueble} no encontrado.`,
      );
    }
  }

  private async assertArrendatarioExists(
    idArrendatario: number,
  ): Promise<void> {
    const arrendatario = await this.arrendatariosRepository.findOne({
      where: { id: idArrendatario },
      select: ["id"],
    });
    if (!arrendatario) {
      throw new NotFoundException(
        `Arrendatario con id ${idArrendatario} no encontrado.`,
      );
    }
  }
}
