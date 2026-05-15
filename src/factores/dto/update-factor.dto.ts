import { PartialType } from "@nestjs/swagger";
import { CreateFactorDto } from "./create-factor.dto";

export class UpdateFactorDto extends PartialType(CreateFactorDto) {}
