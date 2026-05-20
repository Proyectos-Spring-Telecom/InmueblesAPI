import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { CreateLocalZonaInmuebleDto } from "./create-local-zona-inmueble.dto";

export class CreateZonaInmuebleDto {
  @ApiPropertyOptional({ example: "Local 1" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  zonaPrincipal?: string;

  @ApiPropertyOptional({ example: 100.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  superficieZonaM2?: number;

  @ApiPropertyOptional({ example: 50.25 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  superficieDisponibleM2?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  numeroZona?: number;

  @ApiPropertyOptional({
    type: [CreateLocalZonaInmuebleDto],
    description:
      "Locales de la zona. En FormData: zonas[i].locales[j].nombre, zonas[i].locales[j].areaM2, " +
      "zonas[i].locales[j].fachada (FILE), etc.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLocalZonaInmuebleDto)
  locales?: CreateLocalZonaInmuebleDto[];
}
