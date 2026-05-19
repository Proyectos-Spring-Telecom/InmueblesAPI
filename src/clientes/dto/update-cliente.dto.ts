import { ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsOptional, ValidateNested } from "class-validator";
import { CreateClienteDto } from "./create-cliente.dto";
import { UpdateSocioArrendadorDto } from "./update-socio-arrendador.dto";

export class UpdateClienteDto extends PartialType(
  OmitType(CreateClienteDto, ["socios"] as const),
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
