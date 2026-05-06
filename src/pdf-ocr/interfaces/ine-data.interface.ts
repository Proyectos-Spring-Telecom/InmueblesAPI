export type IneFuenteExtraccion = 'MRZ' | 'OCR_CAMPOS' | 'OCR_MIXTO';

/**
 * Datos estructurados extraídos del OCR del frente/reverso de una INE mexicana.
 * Campos ausentes = null (no cadenas vacías).
 */
export interface IneData {
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  nombres: string | null;
  curp: string | null;
  /** true si el CURP se armó por reglas SAT (sin homoclave); false si vino del OCR completo. */
  curpDerivado: boolean;
  claveElector: string | null;
  fechaNacimiento: string | null;
  sexo: string | null;
  domicilio: string | null;
  colonia: string | null;
  codigoPostal: string | null;
  municipio: string | null;
  estado: string | null;
  seccion: string | null;
  anioRegistro: string | null;
  vigencia: string | null;
  emision: string | null;
  estadoClave: string | null;
  municipioClave: string | null;
  localidad: string | null;
  fuenteExtraccion: IneFuenteExtraccion;
}
