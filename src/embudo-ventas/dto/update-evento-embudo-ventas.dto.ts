import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class UpdateEventoEmbudoVentasDto {
  @ApiProperty({
    example: "Se realizó la llamada y el prospecto pidió una visita la próxima semana.",
    description: "Lo que ocurrió en el evento",
  })
  @IsString()
  @IsNotEmpty({ message: "La conclusión del evento es obligatoria" })
  conclusionEvento: string;
}
