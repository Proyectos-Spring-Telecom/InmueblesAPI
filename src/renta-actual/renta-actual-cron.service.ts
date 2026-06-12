import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { RentaActualService } from "./renta-actual.service";

@Injectable()
export class RentaActualCronService {
  private readonly logger = new Logger(RentaActualCronService.name);

  constructor(private readonly rentaActualService: RentaActualService) {}

  /**
   * Cada día a las 00:05 (America/Mexico_City) mueve a histórico y elimina de
   * RentaActual las rentas pagadas cuyo mes ya no es el mes en curso.
   */
  @Cron("5 0 * * *", { timeZone: "America/Mexico_City" })
  async archivarRentasPagadasMesesAnteriores() {
    try {
      const { archivadas } =
        await this.rentaActualService.archivarRentasPagadasMesesAnteriores();

      if (archivadas > 0) {
        this.logger.log(
          `Cron renta-actual: ${archivadas} registro(s) archivado(s) y eliminado(s) de RentaActual.`,
        );
      }
    } catch (error) {
      this.logger.error(
        "Cron renta-actual: error al archivar rentas pagadas de meses anteriores.",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
