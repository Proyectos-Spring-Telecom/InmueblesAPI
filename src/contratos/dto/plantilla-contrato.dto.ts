import { ApiProperty } from "@nestjs/swagger";

export class CampoPlantillaDto {
  @ApiProperty({ example: "razonSocial" })
  clave: string;

  @ApiProperty({ example: "Razón social" })
  etiqueta: string;

  @ApiProperty({
    example: "texto",
    enum: ["texto", "fecha", "numero", "decimal", "correo", "telefono"],
  })
  tipo: string;

  @ApiProperty({ example: null, nullable: true })
  valor: string | number | null;
}

export class SeccionPlantillaDto {
  @ApiProperty({ example: "subarrendador" })
  clave: string;

  @ApiProperty({ example: "Subarrendador" })
  titulo: string;

  @ApiProperty({ type: [CampoPlantillaDto] })
  campos: CampoPlantillaDto[];
}

export class PlantillaContratoDto {
  @ApiProperty({ example: "subarrendamiento-local-comercial" })
  clave: string;

  @ApiProperty({
    example: "Contrato de subarrendamiento de local comercial",
  })
  nombre: string;

  @ApiProperty({ type: [SeccionPlantillaDto] })
  secciones: SeccionPlantillaDto[];
}
