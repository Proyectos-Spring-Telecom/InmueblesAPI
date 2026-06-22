import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ContratoArrendatarios } from "src/entities/ContratoArrendatarios";
import { Repository } from "typeorm";
import { ContratoEstatus } from "./contrato-estatus.enum";

export function assertContratoNoCancelado(
  contrato: Pick<ContratoArrendatarios, "estatus">,
): void {
  if (Number(contrato.estatus) === ContratoEstatus.Baja) {
    throw new BadRequestException(
      "No se permiten operaciones sobre un contrato cancelado (estatus 0).",
    );
  }
}

export async function findContratoActivo(
  contratoRepository: Repository<ContratoArrendatarios>,
  idContrato: number,
  idArrendatario?: number,
): Promise<ContratoArrendatarios> {
  const contrato = await contratoRepository.findOne({
    where: { id: idContrato },
    select: ["id", "idArrendatario", "estatus"],
  });

  if (!contrato) {
    throw new NotFoundException(`Contrato con id ${idContrato} no encontrado.`);
  }

  if (
    idArrendatario != null &&
    Number(contrato.idArrendatario) !== idArrendatario
  ) {
    throw new BadRequestException(
      `El contrato ${idContrato} no pertenece al arrendatario ${idArrendatario}.`,
    );
  }

  assertContratoNoCancelado(contrato);
  return contrato;
}

export async function assertArrendatarioConContratoActivo(
  contratoRepository: Repository<ContratoArrendatarios>,
  idArrendatario: number,
): Promise<void> {
  const activo = await contratoRepository.findOne({
    where: { idArrendatario, estatus: ContratoEstatus.Activo },
    select: ["id"],
  });

  if (!activo) {
    throw new BadRequestException(
      `El arrendatario ${idArrendatario} no tiene contratos activos.`,
    );
  }
}
