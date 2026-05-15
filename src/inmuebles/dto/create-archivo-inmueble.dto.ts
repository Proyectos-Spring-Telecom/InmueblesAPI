import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Item de `archivos[i]` o `imagenes[i]`. Campos esperados en FormData:
 *   archivos[0].nombre
 *   archivos[0].archivo   (FILE)
 *   imagenes[0].nombre
 *   imagenes[0].archivo   (FILE)
 *
 * Tras subir `archivo` a S3 se persistirá en `ArchivosInmuebles.Url`.
 */
export class CreateArchivoInmuebleDto {
  @ApiPropertyOptional({ example: "Contrato firmado" })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  nombre?: string;

  @ApiPropertyOptional({
    description: "Archivo binario.",
    type: "string",
    format: "binary",
  })
  @IsOptional()
  archivo?: any;
}
