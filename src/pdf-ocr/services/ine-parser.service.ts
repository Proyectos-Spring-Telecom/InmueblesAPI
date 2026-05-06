import { Injectable, Logger } from '@nestjs/common';
import type { IneData } from '../interfaces/ine-data.interface';

/** Datos extraídos exclusivamente de la MRZ (TD1 México). */
type MrzData = {
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  nombres: string | null;
  fechaNacimiento: string | null;
  sexo: string | null;
  vigencia: string | null;
  /** Sección electoral: chars 17–20 de la MRZ línea 1 (TD1). */
  seccion: string | null;
};

/** Campos que vienen del OCR de etiquetas / líneas (sin domicilio). */
type OcrFields = {
  curp: string | null;
  claveElector: string | null;
  fechaNacimiento: string | null;
  sexo: string | null;
  seccion: string | null;
  anioRegistro: string | null;
  vigencia: string | null;
  emision: string | null;
  estadoClave: string | null;
  municipioClave: string | null;
  localidad: string | null;
};

type DomicilioFields = Pick<
  IneData,
  'domicilio' | 'colonia' | 'codigoPostal' | 'municipio' | 'estado'
>;

/** Etiqueta DOMICILIO tolerante a errores OCR (DoMICLIO, DOMCILIO, etc.). */
const RE_DOMICILIO_ETIQUETA = /D[oO0]M[IL1]C[IL1]?L?I?[CO0]/i;

/** Clave numérica de estado (clave elector pos. 12–13) → letras CURP. */
const ESTADOS_CURP: Readonly<Record<string, string>> = {
  '01': 'AS',
  '02': 'BC',
  '03': 'BS',
  '04': 'CC',
  '05': 'CL',
  '06': 'CM',
  '07': 'CS',
  '08': 'CH',
  '09': 'DF',
  '10': 'DG',
  '11': 'GT',
  '12': 'GR',
  '13': 'HG',
  '14': 'JC',
  '15': 'MC',
  '16': 'MN',
  '17': 'MS',
  '18': 'NT',
  '19': 'NL',
  '20': 'OC',
  '21': 'PL',
  '22': 'QT',
  '23': 'QR',
  '24': 'SP',
  '25': 'SL',
  '26': 'SR',
  '27': 'TC',
  '28': 'TS',
  '29': 'TL',
  '30': 'VZ',
  '31': 'YN',
  '32': 'ZS',
};

/**
 * INE (México): MRZ primero en todo el texto; OCR complementa; domicilio solo OCR.
 */
@Injectable()
export class IneParserService {
  private readonly logger = new Logger(IneParserService.name);

  parse(combinedText: string): IneData {
    const text = combinedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    this.logger.log('TEXTO_CRUDO_INE: ' + JSON.stringify(text));

    const mrzData = this.detectMRZ(text);
    const ocrData = this.extractFromOCR(text);
    const domicilio = this.extractDomicilio(text);

    let nombresFinal = mrzData?.nombres ?? null;
    if (this.isNombreTruncado(nombresFinal)) {
      const desdeFrente = this.extractNombresFromFrente(text);
      if (desdeFrente) nombresFinal = desdeFrente;
    }
    nombresFinal = this.trimNombreRuidoFic(nombresFinal);

    let curp = ocrData.curp;
    let curpDerivado = false;
    if (!curp && mrzData) {
      const derived = this.deriveCurp(
        mrzData.apellidoPaterno,
        mrzData.apellidoMaterno,
        nombresFinal,
        mrzData.fechaNacimiento,
        mrzData.sexo,
        ocrData.claveElector,
      );
      if (derived) {
        curp = derived;
        curpDerivado = true;
        this.logger.log(`CURP derivado (sin homoclave): ${derived}`);
      }
    }

    const result: IneData = {
      apellidoPaterno: mrzData?.apellidoPaterno ?? null,
      apellidoMaterno: mrzData?.apellidoMaterno ?? null,
      nombres: nombresFinal,
      curp,
      curpDerivado,
      claveElector: ocrData.claveElector,
      fechaNacimiento:
        mrzData?.fechaNacimiento ?? ocrData.fechaNacimiento ?? null,
      sexo: mrzData?.sexo ?? ocrData.sexo ?? null,
      domicilio: domicilio.domicilio,
      colonia: domicilio.colonia,
      codigoPostal: domicilio.codigoPostal,
      municipio: domicilio.municipio,
      estado: domicilio.estado,
      seccion: mrzData?.seccion ?? ocrData.seccion,
      anioRegistro: ocrData.anioRegistro,
      vigencia: mrzData?.vigencia ?? ocrData.vigencia ?? null,
      emision: ocrData.emision,
      estadoClave: ocrData.estadoClave,
      municipioClave: ocrData.municipioClave,
      localidad: ocrData.localidad,
      fuenteExtraccion: mrzData
        ? ocrData.curp || ocrData.claveElector || curpDerivado
          ? 'OCR_MIXTO'
          : 'MRZ'
        : 'OCR_CAMPOS',
    };

    this.logger.log(
      `parse INE: fuente=${result.fuenteExtraccion} curp=${result.curp ?? 'null'} mrz=${mrzData ? 'si' : 'no'}`,
    );

    return result;
  }

  private detectMRZ(text: string): MrzData | null {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const norms = lines
      .map((l) => this.normalizeMrzLine(l))
      .filter((n) => n.length > 0);

    let jPair = -1;
    let line2: string | null = null;
    let line3: string | null = null;

    const assignPair = (j: number, k: number): boolean => {
      const cand2 = norms[j].replace(/O/g, '0');
      if (!/^\d{6}\d?[HM]\d{6,}/i.test(cand2)) return false;
      const n3 = norms[k];
      if (!(/^[A-Z<]{15,}$/i.test(n3) && n3.includes('<<'))) return false;
      line2 = cand2;
      line3 = n3;
      jPair = j;
      return true;
    };

    for (let j = 0; j < norms.length; j++) {
      for (let k = j + 1; k < norms.length; k++) {
        if (assignPair(j, k)) break;
      }
      if (jPair >= 0) break;
    }

    if (jPair < 0) {
      for (let k = 0; k < norms.length; k++) {
        for (let j = 0; j < k; j++) {
          if (assignPair(j, k)) break;
        }
        if (jPair >= 0) break;
      }
    }

    if (!line2 || !line3 || jPair < 0) return null;

    let line1: string | null = null;
    if (jPair > 0) {
      const cand = norms[jPair - 1];
      if (/^IDMEX[A-Z0-9<]{20,}$/i.test(cand) && cand.length >= 21) {
        line1 = cand;
      }
    }
    if (!line1) {
      for (let i = 0; i < jPair; i++) {
        const n = norms[i];
        if (/^IDMEX[A-Z0-9<]{20,}$/i.test(n) && n.length >= 21) {
          line1 = n;
          break;
        }
      }
    }

    return this.parseMrzLines(line1, line2, line3);
  }

  private normalizeMrzLine(line: string): string {
    return line
      .replace(/^[B|b|i|l|:\s\\.]+/, '')
      .replace(/\(/g, 'I')
      .replace(/\|/g, 'I')
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9<]/gi, '')
      .toUpperCase();
  }

  private parseMrzLines(
    line1: string | null,
    line2: string | null,
    line3: string | null,
  ): MrzData | null {
    let seccion: string | null = null;
    if (line1 && line1.length >= 21) {
      const seccionMrz = line1.substring(17, 21);
      if (/^\d{4}$/.test(seccionMrz)) seccion = seccionMrz;
    }

    let fechaNacimiento: string | null = null;
    let sexo: string | null = null;
    let vigencia: string | null = null;

    if (line2 && line2.length >= 10) {
      const yy = Number.parseInt(line2.substring(0, 2), 10);
      const mm = line2.substring(2, 4);
      const dd = line2.substring(4, 6);
      const year = Number.isFinite(yy) ? (yy > 30 ? 1900 + yy : 2000 + yy) : null;
      if (year !== null && /^\d{2}$/.test(mm) && /^\d{2}$/.test(dd)) {
        fechaNacimiento = `${dd}/${mm}/${year}`;
      }
      const ch7 = line2[7];
      const ch8 = line2[8];
      sexo =
        ch7 === 'H' || ch7 === 'M'
          ? ch7
          : ch8 === 'H' || ch8 === 'M'
            ? ch8
            : null;
      const vigOffset =
        sexo !== null && ch7 !== 'H' && ch7 !== 'M' ? 9 : 8;
      const vigSlice = line2.substring(vigOffset, vigOffset + 2);
      vigencia = /^\d{2}$/.test(vigSlice) ? `20${vigSlice}` : null;
    }

    let apellidoPaterno: string | null = null;
    let apellidoMaterno: string | null = null;
    let nombres: string | null = null;

    if (line3 && line3.includes('<<')) {
      const parts = line3.split('<<');
      const apellidosSplit = parts[0].split('<').filter(Boolean);
      apellidoPaterno = apellidosSplit[0] ?? null;
      apellidoMaterno = apellidosSplit[1] ?? null;
      const nameTokens = parts
        .slice(1)
        .flatMap((p) => p.split('<'))
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      nombres = nameTokens.length > 0 ? nameTokens.join(' ') : null;
    }

    const sinContenido =
      !apellidoPaterno &&
      !apellidoMaterno &&
      !nombres &&
      !fechaNacimiento &&
      !sexo &&
      !vigencia &&
      !seccion;
    if (sinContenido) return null;

    return {
      apellidoPaterno,
      apellidoMaterno,
      nombres,
      fechaNacimiento,
      sexo,
      vigencia,
      seccion,
    };
  }

  /** MRZ línea 3 OCR cortada: última palabra muy corta (ej. "ALE" de ALEJANDRA). */
  private isNombreTruncado(nombres: string | null): boolean {
    if (!nombres) return false;
    const palabras = nombres.split(/\s+/).filter(Boolean);
    const ultima = palabras[palabras.length - 1];
    return ultima.length <= 3 && palabras.length >= 1;
  }

  /** Tercera línea útil tras NOMBRE en el frente (nombres completos). */
  private extractNombresFromFrente(text: string): string | null {
    const parts = text.split(/===\s*REVERSO\s*===/i);
    const frente = parts[0] ?? text;
    const STOP =
      /^(SEXO|D[oO0]M[IL1]C[IL1]?L?I?[CO0]|DOMI|CLAVE|CURP|FECHA|A[ÑN]O|ANO|SECCI|VIGENC|EMISI|ESTADO|MUNICIPIO|LOCALIDAD)/i;

    const afterNombre = frente.match(
      new RegExp(
        'NOMBRE[^\\n]*\\n([\\s\\S]*?)(?=' +
          RE_DOMICILIO_ETIQUETA.source +
          '|DOMICI|AV\\s|FRACC\\s|COL\\s|CALLE\\s|CLAVE)',
        'i',
      ),
    );
    if (!afterNombre?.[1]) return null;

    const lines = afterNombre[1]
      .split('\n')
      .map((l) =>
        l
          .toUpperCase()
          .replace(/[^A-ZÁÉÍÓÚÑ\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .filter(
        (l) =>
          l.length >= 3 &&
          /[A-ZÁÉÍÓÚÑ]{3,}/.test(l) &&
          !STOP.test(l),
      )
      .map((l) =>
        l
          .replace(/\s+[A-Z]{1,3}$/, '')
          .replace(/^[A-Z]{1,3}\s+(?=[A-ZÁÉÍÓÚÑ]{3,})/, '')
          .trim(),
      )
      .filter((l) => l.length >= 3);

    const third = lines[2];
    return this.trimNombreRuidoFic(
      third && third.length > 0 ? third.toUpperCase() : null,
    );
  }

  /**
   * Quita palabras cortas finales de ruido OCR (ej. "FIC" tras "ALEJANDRA").
   */
  private trimNombreRuidoFic(nombre: string | null): string | null {
    if (!nombre) return nombre;
    const palabras = nombre.split(/\s+/).filter(Boolean);
    while (palabras.length > 1) {
      const ultima = palabras[palabras.length - 1];
      const anterior = palabras[palabras.length - 2];
      if (ultima.length <= 3 && anterior.length >= 4) {
        palabras.pop();
      } else {
        break;
      }
    }
    const out = palabras.join(' ').trim();
    return out.length > 0 ? out : null;
  }

  /**
   * CURP parcial (16 chars + ??) con reglas SAT a partir de MRZ + clave elector.
   */
  private deriveCurp(
    apPat: string | null,
    apMat: string | null,
    nombres: string | null,
    fecha: string | null,
    sexo: string | null,
    claveElector: string | null,
  ): string | null {
    if (!apPat || !apMat || !nombres || !fecha || !sexo || !claveElector) {
      return null;
    }
    const clave = claveElector.trim().toUpperCase();
    if (clave.length < 14) return null;

    const estadoCode = clave.substring(12, 14);
    const estado = ESTADOS_CURP[estadoCode];
    if (!estado) return null;

    const clean = (s: string): string =>
      s
        .toUpperCase()
        .replace(/\b(DE|LA|EL|DEL|LOS|LAS|Y|MC|MAC|VAN|VON)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const ap = this.toCurpLetters(clean(apPat));
    const am = this.toCurpLetters(clean(apMat));
    const nomClean = clean(nombres);
    const primerNombre = nomClean.split(/\s+/).filter(Boolean)[0] ?? '';
    const no = this.toCurpLetters(primerNombre);

    if (!ap || !am || !no) return null;

    const vocalInterna = (p: string): string => {
      for (let i = 1; i < p.length; i++) {
        const c = p[i];
        if (c && 'AEIOU'.includes(c)) return c;
      }
      return 'X';
    };
    const consInterna = (p: string): string => {
      for (let i = 1; i < p.length; i++) {
        const c = p[i];
        if (c && /[A-ZÑ]/.test(c) && !'AEIOUÑ'.includes(c)) return c;
      }
      return 'X';
    };

    const parts = fecha.trim().split('/');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    if (!y || y.length < 4) return null;
    const yy = y.substring(2);
    if (!/^\d{2}$/.test(yy) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d)) {
      return null;
    }

    const sx = sexo.trim().toUpperCase();
    if (sx !== 'H' && sx !== 'M') return null;

    const curp16 =
      ap[0] +
      vocalInterna(ap) +
      am[0] +
      no[0] +
      yy +
      m +
      d +
      sx +
      estado +
      consInterna(ap) +
      consInterna(am) +
      consInterna(no);

    if (curp16.length !== 16) return null;
    return `${curp16}??`;
  }

  private toCurpLetters(s: string): string {
    return s
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toUpperCase()
      .replace(/[^A-ZÑ]/g, '');
  }

  /**
   * CURP 18 caracteres; corrige O→0 en posiciones 4–9 (fecha en OCR).
   */
  private findCurp(t: string): string | null {
    const upper = t.toUpperCase();
    const candidates = upper.match(/\b[A-Z0-9]{18}\b/g) ?? [];
    for (const c of candidates) {
      const normalized =
        c.substring(0, 4) +
        c.substring(4, 10).replace(/O/g, '0') +
        c.substring(10);
      if (/^[A-Z]{4}\d{6}[A-Z]{6}\d{2}$/.test(normalized)) {
        return normalized;
      }
      if (
        /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]{2}$/.test(normalized) ||
        (/^[A-Z]{4}\d{6}/.test(normalized) &&
          normalized.length === 18 &&
          /^[A-Z0-9]{18}$/.test(normalized))
      ) {
        return normalized;
      }
    }
    return null;
  }

  private extractFromOCR(text: string): OcrFields {
    const upper = text.toUpperCase();

    const curp =
      this.findCurp(text) ??
      this.matchOne(text, /(?:CURP|CUAP)[:\s]+([A-Z]{4}\d{6}[A-Z]{6,8}\d{1,2})/i);

    const claveElector =
      this.matchOne(
        text,
        /CLAVE\s+DE\s+ELECTOR[:\s]+([A-Z0-9]{18,20})/i,
      ) ??
      this.matchOne(text, /CLAVEDEELECTOR[:\s]*([A-Z0-9]{16,20})/i) ??
      this.matchOne(
        text,
        /(?:DEELECTOR|DE\s+ELECTOR)[:\s]+([A-Z0-9]{16,20})/i,
      );

    let fechaNacimiento = this.matchOne(
      text,
      /FECHA\s+DE\s+NACIMIENTO[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
    );
    if (!fechaNacimiento) {
      fechaNacimiento = this.matchOne(text, /\b(\d{2}\/\d{2}\/\d{4})\b/);
    }

    const sexo = this.matchOne(text, /SEXO\s+([HM])\b/i);

    let seccion = this.matchOne(text, /SECCI[OÓ]N[:\s]+(\d{3,4})\b/i);
    if (!seccion) {
      const secM = text.match(/(\d{2}\/\d{2}\/\d{4})[^0-9]*(\d{4})/);
      if (secM?.[2]) seccion = secM[2];
    }

    let vigencia: string | null = null;
    const vigM = text.match(/VIGENCIA\s+(\d{4})\s*[-–]?\s*(\d{4})?/i);
    if (vigM) {
      vigencia =
        vigM[2] && vigM[2].length === 4 ? vigM[2] : vigM[1] ?? null;
    }
    if (!vigencia) {
      const range = text.match(/(\d{4})\s*-\s*(\d{4})/);
      if (range?.[2]) vigencia = range[2];
    }

    const emision = this.matchOne(text, /EMISI[OÓ]N[:\s]+(\d{4})\b/i);

    const curpYearM = upper.match(
      /\b([A-Z]{4}\d{6}[A-Z]{6,8}\d{1,2})\s+(\d{4})\s+\d{2}\b/,
    );
    const anioRegistro =
      curpYearM?.[2] ??
      this.matchOne(text, /A[ÑN]O\s+DE\s+REGISTRO[:\s]+(\d{4})\b/i);

    const estadoClave = this.matchOne(text, /\bESTADO\s+(\d{2})\b/i);
    const municipioClave = this.matchOne(text, /\bMUNICIPIO\s+(\d{3})\b/i);
    const localidad = this.matchOne(text, /\bLOCALIDAD\s+(\d{4})\b/i);

    return {
      curp: curp?.toUpperCase() ?? null,
      claveElector: claveElector?.toUpperCase() ?? null,
      fechaNacimiento,
      sexo,
      seccion,
      anioRegistro,
      vigencia,
      emision,
      estadoClave,
      municipioClave,
      localidad,
    };
  }

  private cleanDomicilioPhysicalLine(line: string): string {
    let s = line
      .replace(/^[^A-Z0-9]*/i, '')
      .replace(/[^A-ZÁÉÍÓÚÑ0-9,\s.]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    s = s
      .replace(/LAREFORMA/gi, 'LA REFORMA')
      .replace(/DELMAIZ/gi, 'DEL MAIZ')
      .replace(/COLBENITO/gi, 'COL BENITO');
    if (!/\d\s+[A-Z]\s*$/i.test(s)) {
      s = s.replace(/\s+[A-Z]{1,2}$/, '').trim();
    }
    return s;
  }

  private readonly RE_CALLE =
    /^(AV|CALLE|C\.|C\s|PASEO|BLVD|CDA|CALZ|CALZADA|\d)/i;
  private readonly RE_COLONIA =
    /^(COL\.?\s|COL\s|FRACC|U\s+HAB|BARRIO|PRIV|COLONIA)/i;

  private extractDomicilio(text: string): DomicilioFields {
    const empty: DomicilioFields = {
      domicilio: null,
      colonia: null,
      codigoPostal: null,
      municipio: null,
      estado: null,
    };

    const blockMatch = text.match(
      new RegExp(
        RE_DOMICILIO_ETIQUETA.source +
          '[:\\s]+([\\s\\S]+?)(?=CLAVE\\s*DE\\s*ELECTOR|CLAVEDEELECTOR|CURP\\b|FECHA\\s+DE\\s+NACIMIENTO|$)',
        'i',
      ),
    );
    let segment: string | null = blockMatch?.[1]?.trim() ?? null;
    if (!segment) {
      segment = this.extractDomicilioFallbackBlock(text);
    }
    if (!segment) return empty;

    const rawLines = segment
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const lines = rawLines.map((l) => this.cleanDomicilioPhysicalLine(l));

    let domicilio: string | null = null;
    let colonia: string | null = null;
    let codigoPostal: string | null = null;

    const munEstRe = /^(.+?),\s*([A-ZÁÉÍÓÚÑ]{2,4})\.?$/i;

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      const cp = ln.match(/\b(\d{5})\b/);
      if (cp) codigoPostal = cp[1];

      if (this.RE_COLONIA.test(ln)) {
        colonia = ln;
      } else if (this.RE_CALLE.test(ln) && !domicilio) {
        domicilio = ln;
      }
    }

    let municipio: string | null = null;
    let estado: string | null = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      const ln = lines[i];
      const m = ln.match(munEstRe);
      if (m) {
        municipio = m[1].replace(/\s+/g, ' ').trim().toUpperCase();
        estado = m[2].replace(/\./g, '').trim().toUpperCase();
        break;
      }
    }

    if (!domicilio && lines.length > 0 && !this.RE_COLONIA.test(lines[0])) {
      domicilio = lines[0];
    }

    return {
      domicilio,
      colonia,
      codigoPostal,
      municipio,
      estado,
    };
  }

  /** Si no hay etiqueta DOMICILIO: primer grupo calle+colonia+ciudad en frente. */
  private extractDomicilioFallbackBlock(combined: string): string | null {
    const frente = combined.match(
      /===\s*FRENTE\s*===\s*([\s\S]*?)(?:===\s*REVERSO\s*===|$)/i,
    )?.[1];
    if (!frente) return null;

    const lines = frente
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    for (let i = 0; i <= lines.length - 3; i++) {
      const cleaned = lines.map((l) => this.cleanDomicilioPhysicalLine(l));
      const a = cleaned[i];
      const b = cleaned[i + 1];
      const c = cleaned[i + 2];
      if (!this.RE_CALLE.test(a)) continue;
      if (!/\d{5}/.test(b)) continue;
      if (!/,/.test(c)) continue;
      return [a, b, c].join('\n');
    }
    return null;
  }

  private matchOne(text: string, re: RegExp): string | null {
    const m = text.match(re);
    const v = m?.[1]?.trim();
    return v && v.length > 0 ? v : null;
  }
}
