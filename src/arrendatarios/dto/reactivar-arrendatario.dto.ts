import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean } from "class-validator";

export class ReactivarArrendatarioDto {
  @ApiProperty({
    example: true,
    description:
      "true: pone Estatus=1 en el arrendatario y sus dependencias " +
      "(servicios, socios, archivos, estacionamientos, pagos, contratos y contrato-locales; " +
      "limpia FechaBaja y vuelve a marcar locales como Ocupado). " +
      "false: solo Reactiva el arrendatario (Estatus=1).",
  })
  @Transform(({ value }) => {
    if (value === true || value === "true" || value === 1 || value === "1") {
      return true;
    }
    if (value === false || value === "false" || value === 0 || value === "0") {
      return false;
    }
    return value;
  })
  @IsBoolean()
  conDependientes: boolean;
}
