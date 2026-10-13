import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsArray, IsOptional, IsString, ValidateNested } from "class-validator";

export class CampoValorPlantillaDto {
  @ApiProperty({ example: "razonSocial" })
  @IsString()
  clave: string;

  @ApiPropertyOptional({ example: "Razón social" })
  @IsOptional()
  @IsString()
  etiqueta?: string;

  @ApiPropertyOptional({ example: "texto" })
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiPropertyOptional({ example: "DESARROLLOS MTH S.A. DE C.V.", nullable: true })
  @Allow()
  @IsOptional()
  valor?: string | number | null;
}

export class SeccionValorPlantillaDto {
  @ApiProperty({ example: "subarrendador" })
  @IsString()
  clave: string;

  @ApiPropertyOptional({ example: "Subarrendador" })
  @IsOptional()
  @IsString()
  titulo?: string;

  @ApiProperty({ type: [CampoValorPlantillaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampoValorPlantillaDto)
  campos: CampoValorPlantillaDto[];
}

export class VistaPreviaPlantillaDto {
  @ApiPropertyOptional({ example: "subarrendamiento-local-comercial" })
  @IsOptional()
  @IsString()
  clave?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiProperty({ type: [SeccionValorPlantillaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeccionValorPlantillaDto)
  secciones: SeccionValorPlantillaDto[];
}
