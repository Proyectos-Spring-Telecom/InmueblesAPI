export const ARRENDADOR_ARCHIVO_FIELDS = [
  "logotipo",
  "constanciaSituacionFiscal",
  "comprobanteDomicilio",
  "actaConstitutiva",
] as const;

export type ArrendadorArchivoField = (typeof ARRENDADOR_ARCHIVO_FIELDS)[number];

export type ArrendadorArchivosUpload = Partial<
  Record<ArrendadorArchivoField, Express.Multer.File[]>
>;

export const ARRENDADOR_FILE_INTERCEPTOR_FIELDS = ARRENDADOR_ARCHIVO_FIELDS.map(
  (name) => ({ name, maxCount: 1 as const }),
);
