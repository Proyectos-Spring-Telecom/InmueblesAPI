import { PartialType } from "@nestjs/swagger";
import { CreateCatServicioDto } from "./create-cat-servicio.dto";

export class UpdateCatServicioDto extends PartialType(CreateCatServicioDto) {}

