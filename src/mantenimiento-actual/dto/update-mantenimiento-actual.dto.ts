import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateMantenimientoActualDto } from "./create-mantenimiento-actual.dto";

export class UpdateMantenimientoActualDto extends PartialType(
  OmitType(CreateMantenimientoActualDto, [
    "idArrendatario",
    "idContrato",
  ] as const),
) {}
