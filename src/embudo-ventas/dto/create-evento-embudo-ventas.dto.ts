import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString } from "class-validator";

export class CreateEventoEmbudoVentasDto {
  @ApiProperty({
    example: "2026-10-20T10:00:00",
    description: "Fecha y hora del próximo evento",
  })
  @IsDateString()
  fhProximoEvento: string;

  @ApiProperty({
    example: 1,
    enum: [1, 2, 3],
    description: "Medio de comunicación: 1 Llamada, 2 Correo, 3 Visita",
  })
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2, 3], {
    message: "MedioComunicacion debe ser 1 (Llamada), 2 (Correo) o 3 (Visita)",
  })
  medioComunicacion: number;

  @ApiPropertyOptional({
    example: 0,
    enum: [0, 1],
    default: 0,
    description: "Estatus del evento: 0 pendiente, 1 realizada. Si no se envía, queda en 0.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1], { message: "Estatus del evento debe ser 0 (pendiente) o 1 (realizada)" })
  estatus?: number;

  @ApiPropertyOptional({
    example: "El prospecto pidió que lo contacten por la tarde.",
    description: "Comentario del evento",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  comentario?: string | null;
}
