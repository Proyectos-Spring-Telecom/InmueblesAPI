import { Injectable, Logger } from '@nestjs/common';
import type {
  ActividadEconomica,
  ConstanciaFiscalData,
  ObligacionFiscal,
  RegimenFiscal,
  TipoContribuyente,
} from '../interfaces/constancia-fiscal.interface';

/**
 * ConstanciaFiscalParserService v4
 *
 * Pipeline: joinContinuationLines → fixPorcentajePegado → insertSeparators
 * → campos + tablas. Probado con constancias nativas y OCR (SAT México).
 */
@Injectable()
export class ConstanciaFiscalParserService {
  private readonly logger = new Logger(ConstanciaFiscalParserService.name);

  /** Pie de página / ruido SAT que no debe fusionarse con líneas OCR anteriores */
  private readonly FOOTER_LINE_RE =
    /^(Contacto|Av\.\s+Hid|MarcaSAT|\{?\+52\}?|\(\+52\)|Atenci[oó]n\s+telef|Ce\s*$|^a\s*$|^Lo\s*$|^ATI$|^ET$|^EE$|^E$|^=)/i;

  private readonly SAT_LABELS = [
    'RFC:',
    'CURP:',
    'Nombre (s):',
    'Primer Apellido:',
    'Segundo Apellido:',
    'Denominación/Razón Social:',
    'Régimen Capital:',
    'Nombre Comercial:',
    'Fecha inicio de operaciones:',
    'Estatus en el padrón:',
    'Fecha de último cambio de estado:',
    'Datos del domicilio registrado',
    'Código Postal:',
    'Tipo de Vialidad:',
    'Nombre de Vialidad:',
    'Número Exterior:',
    'Número Interior:',
    'Nombre de la Colonia:',
    'Nombre de la Localidad:',
    'Nombre del Municipio o Demarcación Territorial:',
    'Nombre de la Entidad Federativa:',
    'Entre Calle:',
    'Y Calle:',
    'Actividades Económicas',
    'Regímenes:',
    'Obligaciones:',
    'Sus datos personales',
  ];

  parse(rawText: string): ConstanciaFiscalData {
    const joined = this.joinContinuationLines(rawText);
    const fixed = this.fixPorcentajePegado(joined);
    const text = this.insertSeparators(fixed);

    const esPersonaFisica = /Nombre \(s\):/.test(fixed);
    const tipoContribuyente: TipoContribuyente = esPersonaFisica
      ? 'PERSONA_FISICA'
      : 'PERSONA_MORAL';

    this.logger.debug(
      `parse: tipo=${tipoContribuyente} joined_len=${joined.length} fixed_len=${fixed.length} texto_len=${text.length}`,
    );

    const data: ConstanciaFiscalData = {
      tipoContribuyente,

      rfc: this.extractRFC(fixed),
      idCIF: this.match(fixed, /idCIF:\s*(\d+)/i),

      curp: this.match(fixed, /CURP:\s*([A-Z0-9]{18})/i),
      nombre: this.between(text, /Nombre \(s\):\s*/i, /\nPrimer Apellido:/i),
      apellidoPaterno: this.between(
        text,
        /Primer Apellido:\s*/i,
        /\nSegundo Apellido:/i,
      ),
      apellidoMaterno: this.between(
        text,
        /Segundo Apellido:\s*/i,
        /\nFecha inicio de operaciones:/i,
      ),

      razonSocial: this.between(
        text,
        /Denominaci[oó]n\/Raz[oó]n Social:\s*/i,
        /\nR[eé]gimen Capital:/i,
      ),
      regimenCapital: this.between(
        text,
        /R[eé]gimen Capital:\s*/i,
        /\nNombre Comercial:/i,
      ),

      nombreComercial: this.betweenNonEmpty(
        text,
        /Nombre Comercial:\s*/i,
        /\n(?:Fecha inicio de operaciones:|Datos del domicilio)/i,
      ),

      fechaInicioOperaciones: this.between(
        text,
        /Fecha inicio de operaciones:\s*/i,
        /\nEstatus en el padr[oó]n:/i,
      ),
      estatusContribuyente: this.between(
        text,
        /Estatus en el padr[oó]n:\s*/i,
        /\nFecha de [uú]ltimo cambio de estado:/i,
      ),
      fechaUltimoCambioEstado: this.between(
        text,
        /Fecha de [uú]ltimo cambio de estado:\s*/i,
        /\n(?:Nombre Comercial:|Datos del domicilio)/i,
      ),

      codigoPostal: this.match(text, /C[oó]digo Postal:\s*(\d{4,5})/i),
      tipoVialidad: this.between(
        text,
        /Tipo de Vialidad:\s*/i,
        /\nNombre de Vialidad:/i,
      ),
      nombreVialidad: this.between(
        text,
        /Nombre de Vialidad:\s*/i,
        /\nN[uú]mero Exterior:/i,
      ),
      numeroExterior: this.between(
        text,
        /N[uú]mero Exterior:\s*/i,
        /\nN[uú]mero Interior:/i,
      ),
      numeroInterior: this.betweenNonEmpty(
        text,
        /N[uú]mero Interior:\s*/i,
        /\nNombre de la Colonia:/i,
      ),
      colonia: this.between(
        text,
        /Nombre de la Colonia:\s*/i,
        /\nNombre de la Localidad:/i,
      ),
      localidad: this.between(
        text,
        /Nombre de la Localidad:\s*/i,
        /\nNombre del Municipio/i,
      ),
      municipio: this.between(
        text,
        /Nombre del Municipio o Demarcaci[oó]n Territorial:\s*/i,
        /\nNombre de la Entidad Federativa:/i,
      ),
      entidadFederativa: this.cleanPageNoise(
        this.between(
          text,
          /Nombre de la Entidad Federativa:\s*/i,
          /\nEntre Calle:/i,
        ),
      ),
      entreCalle: this.cleanPageNoise(
        this.between(text, /Entre Calle:\s*/i, /\nY Calle:/i),
      ),
      yCalle: this.cleanPageNoise(
        this.between(text, /Y Calle:\s*/i, /\nActividades Econ[oó]micas/i),
      ),

      actividadesEconomicas: this.parseActividades(text),
      regimenesFiscales: this.parseRegimenes(text),
      obligaciones: this.parseObligaciones(text),
    };

    this.logger.log(
      `parse: tipo=${tipoContribuyente} rfc=${data.rfc ?? 'null'} ` +
        `razonSocial="${data.razonSocial ?? '-'}" nombre="${data.nombre ?? '-'}" ` +
        `cp=${data.codigoPostal ?? 'null'} ` +
        `actividades=${data.actividadesEconomicas.length} ` +
        `regimenes=${data.regimenesFiscales.length} ` +
        `obligaciones=${data.obligaciones.length}`,
    );

    return data;
  }

  /**
   * Une continuaciones OCR en una sola línea; pies de página SAT pasan a línea vacía.
   */
  private joinContinuationLines(rawText: string): string {
    const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    const out: string[] = [];

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (trimmed === '') {
        continue;
      }
      if (this.FOOTER_LINE_RE.test(trimmed)) {
        out.push('');
        this.logger.debug(`joinContinuationLines: pie_sat omitido="${trimmed.slice(0, 40)}..."`);
        continue;
      }
      if (this.lineStartsWithSatLabel(trimmed)) {
        out.push(trimmed);
        continue;
      }
      if (out.length === 0) {
        out.push(trimmed);
        continue;
      }
      out[out.length - 1] =
        `${out[out.length - 1]} ${trimmed}`.replace(/\s+/g, ' ').trim();
    }

    const joined = out.join('\n');
    this.logger.debug(
      `joinContinuationLines: líneas_entrada=${lines.length} bloques=${out.length} len=${joined.length}`,
    );
    return joined;
  }

  private lineStartsWithSatLabel(trimmedLine: string): boolean {
    const t = trimmedLine.trimStart();
    return this.SAT_LABELS.some((label) => t.startsWith(label));
  }

  /** Inserta espacio entre letra y porcentaje pegados antes de fecha (ej. "...ydrenaje21 11/03/2015"). */
  private fixPorcentajePegado(joined: string): string {
    const fixed = joined.replace(
      /([a-záéíóúñA-ZÁÉÍÓÚÑ])(\d{1,3})\s+(\d{2}\/\d{2}\/\d{4})/g,
      '$1 $2 $3',
    );
    if (fixed.length !== joined.length) {
      this.logger.debug(
        `fixPorcentajePegado: longitud ${joined.length} → ${fixed.length}`,
      );
    }
    return fixed;
  }

  private insertSeparators(text: string): string {
    const escaped = this.SAT_LABELS.map((l) =>
      l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
    const separated = text.replace(
      new RegExp('(' + escaped.join('|') + ')', 'g'),
      '\n$1',
    );
    this.logger.debug(`insertSeparators: len=${text.length} → ${separated.length}`);
    return separated;
  }

  /**
   * RFC: etiqueta nativa, standalone en cédula, o último recurso patrón global.
   */
  private extractRFC(text: string): string | null {
    let m = text.match(/RFC:\s*([A-Z&]{2,4}\d{6}[A-Z0-9]{2,4})/i);
    if (m?.[1]) {
      const v = m[1].trim().toUpperCase();
      this.logger.debug(`extractRFC: estrategia=etiqueta ${v}`);
      return v;
    }
    m = text.match(
      /(?:^|\n)\s*([A-Z&]{2,4}\d{6}[A-Z0-9]{2,4})\s*(?:\n|Datos de Identificaci)/m,
    );
    if (m?.[1]) {
      const v = m[1].trim().toUpperCase();
      this.logger.debug(`extractRFC: estrategia=standalone ${v}`);
      return v;
    }
    m = text.match(/\b([A-Z]{3,4}\d{6}[A-Z0-9]{3,4})\b/);
    if (m?.[1]) {
      const v = m[1].trim().toUpperCase();
      this.logger.debug(`extractRFC: estrategia=patron_global ${v}`);
      return v;
    }
    this.logger.debug('extractRFC: sin coincidencia');
    return null;
  }

  private match(text: string, re: RegExp): string | null {
    return text.match(re)?.[1]?.trim() || null;
  }

  /**
   * Entre startRe y endRe. Si endRe no aparece, solo la primera línea no vacía
   * del resto (evita tragarse el documento entero).
   */
  private between(text: string, startRe: RegExp, endRe: RegExp): string | null {
    const m = text.match(startRe);
    if (!m || m.index === undefined) return null;
    const start = m.index + m[0].length;
    const sub = text.slice(start);
    const endM = sub.match(endRe);
    let value: string;
    if (endM?.index !== undefined) {
      value = sub.slice(0, endM.index).trim();
    } else {
      const firstNonEmpty = sub
        .split(/\n/)
        .map((l) => l.trim())
        .find((l) => l.length > 0);
      value = firstNonEmpty ?? '';
    }
    return value.length > 0 ? value : null;
  }

  private betweenNonEmpty(
    text: string,
    startRe: RegExp,
    endRe: RegExp,
  ): string | null {
    const value = this.between(text, startRe, endRe);
    if (!value) return null;
    const isNextLabel =
      /^(Fecha|R[eé]gimen|Estatus|N[uú]mero|Nombre|C[oó]digo|Tipo|Datos|Entre|Y Calle|Actividades|Obligaciones|Sus datos|CURP|Primer|Segundo)/i;
    return isNextLabel.test(value) ? null : value;
  }

  private cleanPageNoise(value: string | null): string | null {
    if (!value) return null;
    const cleaned = value
      .replace(/\s*Página \[\d+\] de \[\d+\]\s*/gi, '')
      .trim();
    return cleaned.length > 0 ? cleaned : null;
  }

  private cleanOcrNoise(s: string): string {
    return s.replace(/\s+/g, ' ').trim();
  }

  private parseActividades(text: string): ActividadEconomica[] {
    const blockM = text.match(
      /Actividades Econ[oó]micas:?\s*([\s\S]*?)\nReg[ií]menes:/i,
    );
    if (!blockM?.[1]) {
      this.logger.debug('parseActividades: bloque vacío');
      return [];
    }

    const block = blockM[1]
      .replace(
        /Orden\s+Actividad Econ[oó]mica\s+Porcentaje\s+Fecha Inicio\s+Fecha Fin/i,
        '',
      )
      .trim();

    const results: ActividadEconomica[] = [];

    if (!block.includes('\n')) {
      const rowRe =
        /(\d+)\s+(.+?)\s+(\d{1,3})\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}\/\d{2}\/\d{4}))?(?=\s*\d+\s+[A-ZÁÉÍÓÚÑ]|\s*$)/gi;
      let m: RegExpExecArray | null;
      while ((m = rowRe.exec(block)) !== null) {
        results.push({
          orden: Number.parseInt(m[1], 10),
          descripcion: m[2].trim(),
          porcentaje: Number.parseInt(m[3], 10),
          fechaInicio: m[4] ?? null,
          fechaFin: m[5] ?? null,
        });
      }
      this.logger.debug(
        `parseActividades: modo=native_plano encontradas=${results.length}`,
      );
    } else {
      const lines = block
        .split(/\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      let pending = '';
      const rowReLine =
        /^(\d+)\s+(.+?)\s+(\d{1,3})\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}\/\d{2}\/\d{4}))?$/;

      for (const line of lines) {
        const merged = pending ? `${pending} ${line}` : line;
        const rm = merged.match(rowReLine);
        if (rm) {
          results.push({
            orden: Number.parseInt(rm[1], 10),
            descripcion: this.cleanOcrNoise(rm[2]),
            porcentaje: Number.parseInt(rm[3], 10),
            fechaInicio: rm[4] ?? null,
            fechaFin: rm[5] ?? null,
          });
          pending = '';
        } else {
          pending = merged;
        }
      }
      this.logger.debug(
        `parseActividades: modo=ocr_multilínea encontradas=${results.length}`,
      );
    }

    return results;
  }

  private parseRegimenes(text: string): RegimenFiscal[] {
    const blockM = text.match(
      /\nReg[ií]menes:\s*([\s\S]*?)(?:\nObligaciones:|\nSus datos personales|$)/i,
    );
    if (!blockM?.[1]) {
      this.logger.debug('parseRegimenes: bloque vacío');
      return [];
    }

    const block = blockM[1]
      .replace(/R[eé]gimen\s+Fecha Inicio\s+Fecha Fin/i, '')
      .trim();

    const results: RegimenFiscal[] = [];
    const re =
      /(.+?)\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}\/\d{2}\/\d{4}))?(?=\s|$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) {
      results.push({
        descripcion: m[1].trim(),
        fechaInicio: m[2] ?? null,
        fechaFin: m[3] ?? null,
      });
    }

    this.logger.debug(`parseRegimenes: encontrados=${results.length}`);
    return results;
  }

  private parseObligaciones(text: string): ObligacionFiscal[] {
    const blockM = text.match(
      /Obligaciones:([\s\S]*?)(?:Sus datos personales|Cadena Original|$)/i,
    );
    if (!blockM?.[1]) {
      this.logger.debug('parseObligaciones: bloque vacío');
      return [];
    }

    const block = blockM[1]
      .replace(
        /Descripci[oó]n de la Obligaci[oó]n\s+Descripci[oó]n Vencimiento\s+Fecha Inicio\s+Fecha Fin/i,
        '',
      )
      .replace(/(\w|\.)(\d{2}\/\d{2}\/\d{4})/g, '$1\n$2')
      .trim();

    const results: ObligacionFiscal[] = [];
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    let pending = '';

    for (const line of lines) {
      const dateM = line.match(
        /^(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}\/\d{2}\/\d{4}))?(.*)$/,
      );

      if (dateM) {
        const fullText = pending.trim();
        if (fullText) {
          const splitRe =
            /(Conjuntamente|A\s+m[aá]s\s+tardar|Dentro\s+de\s+los|Al\s+momento)/i;
          const splitM = fullText.match(splitRe);
          let descripcion = fullText;
          let vencimiento: string | null = null;

          if (splitM?.index !== undefined) {
            descripcion = fullText.substring(0, splitM.index).trim();
            vencimiento = fullText.substring(splitM.index).trim();
          }

          results.push({
            descripcion: descripcion || fullText,
            vencimiento,
            fechaInicio: dateM[1] ?? null,
            fechaFin: dateM[2] ?? null,
          });
        }
        pending = dateM[3] ?? '';
      } else {
        pending += ' ' + line;
      }
    }

    this.logger.debug(`parseObligaciones: encontradas=${results.length}`);
    return results;
  }
}
