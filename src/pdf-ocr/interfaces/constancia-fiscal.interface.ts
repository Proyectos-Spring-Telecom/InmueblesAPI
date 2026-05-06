export type TipoContribuyente = 'PERSONA_FISICA' | 'PERSONA_MORAL';

export interface ActividadEconomica {
  orden: number;
  descripcion: string;
  porcentaje: number;
  fechaInicio: string | null;
  fechaFin: string | null;
}

export interface RegimenFiscal {
  descripcion: string;
  fechaInicio: string | null;
  fechaFin: string | null;
}

export interface ObligacionFiscal {
  descripcion: string;
  vencimiento: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
}

export interface ConstanciaFiscalData {
  tipoContribuyente: TipoContribuyente;

  rfc: string | null;
  idCIF: string | null;

  curp: string | null;
  nombre: string | null;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;

  razonSocial: string | null;
  regimenCapital: string | null;

  nombreComercial: string | null;

  fechaInicioOperaciones: string | null;
  estatusContribuyente: string | null;
  fechaUltimoCambioEstado: string | null;

  codigoPostal: string | null;
  tipoVialidad: string | null;
  nombreVialidad: string | null;
  numeroExterior: string | null;
  numeroInterior: string | null;
  colonia: string | null;
  localidad: string | null;
  municipio: string | null;
  entidadFederativa: string | null;
  entreCalle: string | null;
  yCalle: string | null;

  actividadesEconomicas: ActividadEconomica[];
  regimenesFiscales: RegimenFiscal[];
  obligaciones: ObligacionFiscal[];
}
