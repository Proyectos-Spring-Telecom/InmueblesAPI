import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional, ValidateIf } from "class-validator";

export class UpdateMapaInmuebleDto {
  @ApiPropertyOptional({
    description: "GeoJSON u otro objeto JSON del mapa del inmueble. Enviar null para limpiar.",
    example: { type: "FeatureCollection", features: [] },
  })
  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsObject()
  mapaInmueble?: object | null;
}
