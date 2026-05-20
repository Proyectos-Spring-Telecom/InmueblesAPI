import { PartialType } from "@nestjs/swagger";
import { CreateEstacionamientoDto } from "./create-estacionamiento.dto";

export class UpdateEstacionamientoDto extends PartialType(
  CreateEstacionamientoDto,
) {}
