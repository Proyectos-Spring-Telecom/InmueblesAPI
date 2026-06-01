import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { BanxicoConsultaResponseDto } from './dto/banxico-consulta-response.dto';
import { BanxicoRangoQueryDto } from './dto/banxico-rango-query.dto';
import { BanxicoClientService } from './services/banxico-client.service';

@ApiTags('INPC — Banxico')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('inpc/banxico')
export class InpcBanxicoController {
  constructor(private readonly banxicoClient: BanxicoClientService) {}

  @Get('datos')
  @ApiOperation({
    summary: 'Consultar serie SP1 en Banxico (rango de fechas)',
    description:
      'Proxy a [Banxico SIE API](https://www.banxico.org.mx/SieAPIRest/service/v1/doc/consultaDatosSerieRango). ' +
      'Usa `decimales=sinCeros` e incluye incrementos `PorcAnual` y `PorcAcumAnual`. ' +
      'Solo consulta; no guarda en base de datos.\n\n' +
      '**Significado de los campos en `datos[]`:**\n' +
      '- `indice` — Nivel del INPC (índice general nacional).\n' +
      '- `porcAnual` — Inflación interanual (% vs. el mismo mes del año anterior).\n' +
      '- `porcAcumAnual` — Inflación acumulada del año en curso (% desde enero hasta ese mes).',
  })
  @ApiOkResponse({
    type: BanxicoConsultaResponseDto,
    description: 'Serie SP1 con índice e incrementos explicados en cada propiedad',
  })
  consultar(
    @Query() query: BanxicoRangoQueryDto,
  ): Promise<BanxicoConsultaResponseDto> {
    return this.banxicoClient.consultarSerieRango(
      query.fechaInicial,
      query.fechaFinal,
    );
  }
}
