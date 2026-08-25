import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateRentaActualDto } from "./create-renta-actual.dto";

export class UpdateRentaActualDto extends PartialType(
  OmitType(CreateRentaActualDto, [
    "idArrendatario",
    "idContrato",
    "fechaInicio",
  ] as const),
) {}
