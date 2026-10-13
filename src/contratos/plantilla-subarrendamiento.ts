export type TipoCampoPlantilla =
  | "texto"
  | "fecha"
  | "numero"
  | "decimal"
  | "correo"
  | "telefono";

export interface CampoPlantilla {
  clave: string;
  etiqueta: string;
  tipo: TipoCampoPlantilla;
  valor: string | number | null;
}

export interface SeccionPlantilla {
  clave: string;
  titulo: string;
  campos: CampoPlantilla[];
}

function campo(
  clave: string,
  etiqueta: string,
  tipo: TipoCampoPlantilla,
): CampoPlantilla {
  return { clave, etiqueta, tipo, valor: null };
}

export const PLANTILLA_SUBARRENDAMIENTO = {
  clave: "subarrendamiento-local-comercial",
  nombre: "Contrato de subarrendamiento de local comercial",
  secciones: [
    {
      clave: "documento",
      titulo: "Documento",
      campos: [campo("folio", "Folio", "texto")],
    },
    {
      clave: "subarrendador",
      titulo: "Subarrendador",
      campos: [
        campo("razonSocial", "Razón social", "texto"),
        campo("representante", "Representante legal", "texto"),
        campo("numeroEscrituraConstitutiva", "Número de escritura constitutiva", "texto"),
        campo("fechaEscrituraConstitutiva", "Fecha de escritura constitutiva", "fecha"),
        campo("numeroEscrituraPoder", "Número de escritura del poder", "texto"),
        campo("fechaEscrituraPoder", "Fecha de la escritura del poder", "fecha"),
        campo("notarioPoder", "Notario del poder", "texto"),
        campo("numeroNotariaPoder", "Número de notaría del poder", "texto"),
        campo("ciudadNotariaPoder", "Ciudad de la notaría del poder", "texto"),
        campo("domicilio", "Domicilio", "texto"),
        campo("correo", "Correo", "correo"),
        campo("telefono", "Teléfono", "telefono"),
        campo("domicilioAlterno", "Domicilio alterno", "texto"),
        campo("correoAlterno", "Correo alterno", "correo"),
      ],
    },
    {
      clave: "inmueble",
      titulo: "Inmueble",
      campos: [
        campo("calle", "Calle", "texto"),
        campo("interior", "Interior", "texto"),
        campo("local", "Local", "texto"),
        campo("colonia", "Colonia", "texto"),
        campo("municipio", "Municipio", "texto"),
        campo("cp", "Código postal", "texto"),
        campo("estado", "Estado", "texto"),
        campo("superficieM2", "Superficie (m2)", "decimal"),
        campo("usoSuelo", "Uso de suelo", "texto"),
        campo("destino", "Destino del local", "texto"),
      ],
    },
    {
      clave: "subarrendatario",
      titulo: "Subarrendatario",
      campos: [
        campo("nombre", "Nombre", "texto"),
        campo("nacionalidad", "Nacionalidad", "texto"),
        campo("rfc", "RFC", "texto"),
        campo("domicilioFiscal", "Domicilio fiscal", "texto"),
        campo("correo", "Correo", "correo"),
        campo("telefono", "Teléfono", "telefono"),
      ],
    },
    {
      clave: "obligadoSolidario",
      titulo: "Obligado solidario",
      campos: [
        campo("nombre", "Nombre", "texto"),
        campo("curp", "CURP", "texto"),
        campo("domicilio", "Domicilio", "texto"),
        campo("correo", "Correo", "correo"),
        campo("telefono", "Teléfono", "telefono"),
      ],
    },
    {
      clave: "condiciones",
      titulo: "Condiciones",
      campos: [
        campo("fechaEntrega", "Fecha de entrega", "fecha"),
        campo("fechaInicioVigencia", "Fecha de inicio de vigencia", "fecha"),
        campo("vigenciaMeses", "Vigencia (meses)", "numero"),
        campo("diasGracia", "Días de gracia", "numero"),
        campo("rentaMensual", "Renta mensual", "decimal"),
        campo("porcentajeMantenimiento", "Mantenimiento (% de la renta)", "decimal"),
        campo("diaLimitePago", "Día límite de pago", "numero"),
        campo("tasaMoratoriaDiaria", "Tasa moratoria diaria (%)", "decimal"),
        campo("topeMoratorioMensual", "Tope moratorio mensual (%)", "decimal"),
        campo("deposito", "Depósito en garantía", "decimal"),
        campo("penaConvencional", "Pena convencional", "decimal"),
        campo("diasDevolucionDeposito", "Días para devolver el depósito", "numero"),
        campo("mesesRenovacionMax", "Meses máximos de renovación", "numero"),
      ],
    },
    {
      clave: "pago",
      titulo: "Cuenta de pago",
      campos: [
        campo("beneficiario", "Beneficiario", "texto"),
        campo("banco", "Institución bancaria", "texto"),
        campo("clabe", "CLABE", "texto"),
      ],
    },
    {
      clave: "extras",
      titulo: "Estacionamiento y giro",
      campos: [
        campo("cajonesEstacionamiento", "Cajones de estacionamiento", "numero"),
        campo("corporativo", "Corporativo", "texto"),
        campo("exclusividadGiro", "Giro con exclusividad", "texto"),
      ],
    },
  ] satisfies SeccionPlantilla[],
};

const VALORES_EJEMPLO_SUBARRENDAMIENTO: Record<string, string> = {
  "documento.folio": "C62728",
  "subarrendador.razonSocial": "INMOBILIARIA LOMA VERDE S.A. DE C.V.",
  "subarrendador.representante": "MARIANA SOLÍS HERRERA",
  "subarrendador.numeroEscrituraConstitutiva": "85,210",
  "subarrendador.fechaEscrituraConstitutiva": "2012-04-18",
  "subarrendador.numeroEscrituraPoder": "102,448",
  "subarrendador.fechaEscrituraPoder": "2019-09-03",
  "subarrendador.notarioPoder": "el licenciado Andrés Beltrán Cruz",
  "subarrendador.numeroNotariaPoder": "48",
  "subarrendador.ciudadNotariaPoder": "Cuernavaca, Morelos",
  "subarrendador.domicilio":
    "Avenida Plan de Ayala 120, Interior 4, Colonia Acapantzingo, Municipio Cuernavaca, C.P. 62440, Morelos",
  "subarrendador.correo": "contacto@lomaverde.example",
  "subarrendador.telefono": "+52 777 100 2030",
  "subarrendador.domicilioAlterno":
    "Paseo de la Reforma 222, piso 8, Colonia Juárez, Alcaldía Cuauhtémoc, C.P. 06600, Ciudad de México",
  "subarrendador.correoAlterno": "avisos@lomaverde.example",
  "inmueble.calle": "Avenida Morelos Sur",
  "inmueble.interior": "15",
  "inmueble.local": "Local 2A",
  "inmueble.colonia": "Delicias",
  "inmueble.municipio": "Cuernavaca",
  "inmueble.cp": "62240",
  "inmueble.estado": "Morelos",
  "inmueble.superficieM2": "85.50",
  "inmueble.usoSuelo": "Local comercial",
  "inmueble.destino": "Cafetería y panadería",
  "subarrendatario.nombre": "ELENA PATRICIA NÚÑEZ RÍOS",
  "subarrendatario.nacionalidad": "mexicana",
  "subarrendatario.rfc": "NURP900101AB1",
  "subarrendatario.domicilioFiscal":
    "Calle Jacarandas 48, Colonia Jardines de Cuernavaca, Municipio Cuernavaca, C.P. 62360, Morelos",
  "subarrendatario.correo": "elena.nunez@example.com",
  "subarrendatario.telefono": "+52 777 200 3040",
  "obligadoSolidario.nombre": "RICARDO ALONSO PEÑA GIL",
  "obligadoSolidario.curp": "PEGR850512HMSNLC09",
  "obligadoSolidario.domicilio":
    "Calle Bugambilias 9, Colonia Lomas de Cortés, Municipio Cuernavaca, C.P. 62240, Morelos",
  "obligadoSolidario.correo": "ricardo.pena@example.com",
  "obligadoSolidario.telefono": "+52 777 300 4050",
  "condiciones.fechaEntrega": "2026-08-01",
  "condiciones.fechaInicioVigencia": "2026-08-01",
  "condiciones.vigenciaMeses": "12",
  "condiciones.diasGracia": "90",
  "condiciones.rentaMensual": "35000",
  "condiciones.porcentajeMantenimiento": "10",
  "condiciones.diaLimitePago": "5",
  "condiciones.tasaMoratoriaDiaria": "0.5",
  "condiciones.topeMoratorioMensual": "10",
  "condiciones.deposito": "35000",
  "condiciones.penaConvencional": "35000",
  "condiciones.diasDevolucionDeposito": "30",
  "condiciones.mesesRenovacionMax": "12",
  "pago.beneficiario": "INMOBILIARIA LOMA VERDE S.A. DE C.V.",
  "pago.banco": "BBVA México",
  "pago.clabe": "012180001234567890",
  "extras.cajonesEstacionamiento": "2",
  "extras.corporativo": "Plaza del Parque",
  "extras.exclusividadGiro": "cafetería",
};

export function plantillaSubarrendamientoEjemplo() {
  return {
    ...PLANTILLA_SUBARRENDAMIENTO,
    secciones: PLANTILLA_SUBARRENDAMIENTO.secciones.map((seccion) => ({
      ...seccion,
      campos: seccion.campos.map((item) => ({
        ...item,
        valor:
          VALORES_EJEMPLO_SUBARRENDAMIENTO[`${seccion.clave}.${item.clave}`] ??
          item.valor,
      })),
    })),
  };
}
