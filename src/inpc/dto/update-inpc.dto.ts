import { PartialType } from "@nestjs/swagger";
import { CreateInpcDto } from "./create-inpc.dto";

export class UpdateInpcDto extends PartialType(CreateInpcDto) {}
