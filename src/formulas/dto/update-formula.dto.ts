import { PartialType } from "@nestjs/swagger";
import { CreateFormulaDto } from "./create-formula.dto";

export class UpdateFormulaDto extends PartialType(CreateFormulaDto) {}
