import { PartialType } from "@nestjs/swagger";
import { CreateHistoricoPagoRentaDto } from "./create-historico-pago-renta.dto";

export class UpdateHistoricoPagoRentaDto extends PartialType(
  CreateHistoricoPagoRentaDto,
) {}
