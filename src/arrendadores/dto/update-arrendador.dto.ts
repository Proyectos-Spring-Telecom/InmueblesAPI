import { ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsOptional, ValidateNested } from "class-validator";
import { CreateArrendadorDto } from "./create-arrendador.dto";
import { UpdateSocioArrendadorDto } from "./update-socio-arrendador.dto";

export class UpdateArrendadorDto extends PartialType(
  OmitType(CreateArrendadorDto, ["socios"] as const),
) {
  @ApiPropertyOptional({
    type: [UpdateSocioArrendadorDto],
    description:
      "Socios: con id actualiza datos y/o documentos; sin id crea socio nuevo.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSocioArrendadorDto)
  socios?: UpdateSocioArrendadorDto[];
}
