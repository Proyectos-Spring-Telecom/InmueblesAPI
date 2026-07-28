export const CLIENTE_ARCHIVO_FIELDS = [
  "logotipo",
  "constanciaSituacionFiscal",
  "comprobanteDomicilio",
  "actaConstitutiva",
] as const;

export type ClienteArchivoField = (typeof CLIENTE_ARCHIVO_FIELDS)[number];

export type ClienteArchivosUpload = Partial<
  Record<ClienteArchivoField, Express.Multer.File[]>
>;

export const CLIENTE_FILE_INTERCEPTOR_FIELDS = CLIENTE_ARCHIVO_FIELDS.map(
  (name) => ({ name, maxCount: 1 as const }),
);
