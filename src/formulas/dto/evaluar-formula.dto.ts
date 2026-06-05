import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional } from "class-validator";

export class EvaluarFormulaDto {
  @ApiProperty({ example: 1, description: "ID de la fórmula a evaluar" })
  @Type(() => Number)
  @IsInt()
  idFormula: number;

  @ApiPropertyOptional({
    example: 5,
    description: "ID del contrato (solo para auditoría, no afecta el cálculo)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idContrato?: number;

  @ApiPropertyOptional({
    example: 3,
    description: "ID del arrendatario (solo para auditoría)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idArrendatario?: number;
}
