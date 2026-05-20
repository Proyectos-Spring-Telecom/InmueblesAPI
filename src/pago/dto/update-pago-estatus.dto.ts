import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum } from "class-validator";
import { PagoEstatus } from "src/common/pago-estatus.enum";

export class UpdatePagoEstatusDto {
  @ApiProperty({
    example: PagoEstatus.Pagado,
    enum: PagoEstatus,
    description: "PagoEstatus: 0 Cancelado, 1 Pagado, 2 Pendiente",
  })
  @Type(() => Number)
  @IsEnum(PagoEstatus)
  estatus: PagoEstatus;
}
