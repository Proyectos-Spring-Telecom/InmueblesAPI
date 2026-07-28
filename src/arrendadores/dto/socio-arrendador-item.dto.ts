import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

/** En PUT del cliente usar `socios[i].id` para actualizar un socio existente. */
export class SocioArrendadorItemDto {
  @ApiProperty({ example: "Socio A" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  nombre: string;

  @ApiPropertyOptional({ example: "XAXX010101000" })
  @IsOptional()
  @IsString()
  @MaxLength(25)
  rfc?: string;

  @ApiPropertyOptional({ type: "string", format: "binary" })
  @IsOptional()
  constanciaFiscalArchivo?: any;

  @ApiPropertyOptional({ type: "string", format: "binary" })
  @IsOptional()
  comprobanteDomicilioArchivo?: any;

  @ApiPropertyOptional({ type: "string", format: "binary" })
  @IsOptional()
  identificacionOficialArchivo?: any;
}
