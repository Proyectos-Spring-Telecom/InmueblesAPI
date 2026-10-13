import { existsSync } from "fs";
import { join } from "path";
import PDFDocument from "pdfkit";
import { parrafosContrato } from "./contrato-subarrendamiento.texto";
import { SeccionValorPlantillaDto } from "./dto/vista-previa-plantilla.dto";

const FUENTE = "Figtree";
const FUENTE_NEGRITA = "Figtree-Bold";
const TAMANO = 10;
const INTERLINEADO = 1;
const MARGEN_IZQUIERDO = 43;
const MARGEN_DERECHO = 44;
const MARGEN_SUPERIOR = 68;
const MARGEN_INFERIOR = 72;

function rutaFuente(nombre: string): string {
  const compilada = join(__dirname, "fonts", nombre);
  if (existsSync(compilada)) return compilada;
  return join(process.cwd(), "src/contratos/fonts", nombre);
}

const BLANCO = "______________";

type Leer = (seccion: string, clave: string) => string;

function textoPlano(valor: unknown): string | null {
  if (valor == null) return null;
  const texto = String(valor).trim();
  return texto ? texto : null;
}

function crearLector(secciones: SeccionValorPlantillaDto[]): Leer {
  const valores = new Map<string, string>();
  for (const seccion of secciones ?? []) {
    for (const campo of seccion.campos ?? []) {
      const texto = textoPlano(campo.valor);
      if (texto) valores.set(`${seccion.clave}.${campo.clave}`, texto);
    }
  }
  return (seccion, clave) => valores.get(`${seccion}.${clave}`) ?? BLANCO;
}

function dinero(leer: Leer, seccion: string, clave: string): string {
  const valor = leer(seccion, clave);
  if (valor === BLANCO) return valor;
  const numero = Number(valor.replace(/,/g, ""));
  if (Number.isNaN(numero)) return valor;
  return `$${numero.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} M.N.`;
}

function fecha(leer: Leer, seccion: string, clave: string): string {
  const valor = leer(seccion, clave);
  if (valor === BLANCO) return valor;
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  const fechaValor = partes
    ? new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]))
    : new Date(valor);
  if (Number.isNaN(fechaValor.getTime())) return valor;
  return fechaValor.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function domicilioInmueble(leer: Leer): string {
  return [
    leer("inmueble", "calle"),
    `Interior ${leer("inmueble", "interior")}`,
    leer("inmueble", "local"),
    `Colonia ${leer("inmueble", "colonia")}`,
    `Municipio ${leer("inmueble", "municipio")}`,
    `C.P. ${leer("inmueble", "cp")}`,
    leer("inmueble", "estado"),
  ].join(", ");
}

const ORDINALES = [
  "TRIGÉSIMA SEXTA",
  "TRIGÉSIMA QUINTA",
  "TRIGÉSIMA CUARTA",
  "TRIGÉSIMA TERCERA",
  "TRIGÉSIMA SEGUNDA",
  "TRIGÉSIMA PRIMERA",
  "VIGÉSIMA NOVENA",
  "VIGÉSIMA OCTAVA",
  "VIGÉSIMA SÉPTIMA",
  "VIGÉSIMA SEXTA",
  "VIGÉSIMA QUINTA",
  "VIGÉSIMA CUARTA",
  "VIGÉSIMA TERCERA",
  "VIGÉSIMA SEGUNDA",
  "VIGÉSIMA PRIMERA",
  "DÉCIMA NOVENA",
  "DÉCIMA OCTAVA",
  "DÉCIMA SÉPTIMA",
  "DÉCIMA SEXTA",
  "DÉCIMA QUINTA",
  "DÉCIMA CUARTA",
  "DÉCIMA TERCERA",
  "DÉCIMA SEGUNDA",
  "DÉCIMA PRIMERA",
  "DÉCIMA",
  "NOVENA",
  "OCTAVA",
  "SÉPTIMA",
  "SEXTA",
  "QUINTA",
  "CUARTA",
  "TERCERA",
  "SEGUNDA",
  "PRIMERA",
];

const TERMINOS = [
  "“Inmueble”",
  "“Fecha de Entrega”",
  "“Renta”",
  "“Depósito”",
  "“Pena Convencional”",
  "“Plazo Forzoso”",
];

function marcarNegritas(texto: string): string {
  let salida = texto;
  for (const termino of TERMINOS) {
    salida = salida.split(termino).join(`{{${termino}}}`);
  }
  for (const ordinal of ORDINALES) {
    const prefijo = `${ordinal}.`;
    if (!salida.startsWith(prefijo)) continue;
    const despues = salida.slice(prefijo.length);
    const punto = despues.indexOf(".");
    if (punto >= 0) {
      const titulo = `${prefijo}${despues.slice(0, punto + 1)}`.replace(/\s+/g, " ").trim();
      const resto = despues.slice(punto + 1).trimStart();
      salida = titulo.startsWith("TRIGÉSIMA SEXTA.")
        ? `**TRIGÉSIMA SEXTA.** {{Firma electrónica.}} ${resto}`
        : `**${titulo}** ${resto}`;
    }
    break;
  }
  if (!salida.startsWith("**") && /^[A-I]\. /.test(salida)) {
    salida = `**${salida.slice(0, 2)}**${salida.slice(2)}`;
  }
  return salida;
}

function partesNegrita(texto: string): { bold: boolean; subrayado: boolean; text: string }[] {
  const partes = texto
    .split(/(\*\*[^*]*\*\*|\{\{[^{}]*\}\})/g)
    .filter((parte) => parte.length > 0)
    .map((parte) => {
      if (parte.startsWith("{{") && parte.endsWith("}}") && parte.length >= 4) {
        return { bold: true, subrayado: true, text: parte.slice(2, -2) };
      }
      if (parte.startsWith("**") && parte.endsWith("**") && parte.length >= 4) {
        return { bold: true, subrayado: false, text: parte.slice(2, -2) };
      }
      return { bold: false, subrayado: false, text: parte };
    })
    .filter((parte) => parte.text.length > 0);
  for (let i = 1; i < partes.length; i++) {
    const espacios = /^ +/.exec(partes[i].text);
    if (!espacios) continue;
    partes[i - 1].text += espacios[0];
    partes[i].text = partes[i].text.slice(espacios[0].length);
  }
  return partes.filter((parte) => parte.text.length > 0);
}

function textoSinMarcas(texto: string): string {
  return texto.replace(/\*\*/g, "").replace(/\{\{|\}\}/g, "");
}

type DocumentoPdf = InstanceType<typeof PDFDocument>;

function escribirMixto(
  doc: DocumentoPdf,
  texto: string,
  opciones: {
    align: "left" | "justify" | "center";
    todoNegrita?: boolean;
    subrayado?: boolean;
    width?: number;
  },
) {
  const partes = opciones.todoNegrita
    ? [{ bold: true, subrayado: Boolean(opciones.subrayado), text: textoSinMarcas(texto) }]
    : partesNegrita(texto);
  partes.forEach((parte, indice) => {
    doc.font(parte.bold ? FUENTE_NEGRITA : FUENTE).fontSize(TAMANO).text(parte.text, {
      align: opciones.align,
      lineGap: INTERLINEADO,
      underline: parte.subrayado,
      width: opciones.width,
      continued: indice < partes.length - 1,
    });
  });
}

function esSeccionCentrada(texto: string): boolean {
  return texto === "DECLARACIONES" || texto === "CLÁUSULAS";
}

const ANCHO_COLUMNA = 239;
const COLUMNA_IZQUIERDA = 43;
const COLUMNA_DERECHA = 330;

function textoEnColumna(
  doc: DocumentoPdf,
  texto: string,
  x: number,
  y: number,
  negrita: boolean,
) {
  doc.font(negrita ? FUENTE_NEGRITA : FUENTE).fontSize(TAMANO).text(texto, x, y, {
    width: ANCHO_COLUMNA,
    align: "center",
    lineGap: 0,
  });
}

function lineaFirma(doc: DocumentoPdf, x: number, y: number) {
  doc.save();
  doc.strokeColor("#000000").lineWidth(0.7);
  doc.moveTo(x, y).lineTo(x + ANCHO_COLUMNA, y).stroke();
  doc.restore();
}

function dibujarFirmas(doc: DocumentoPdf, leer: Leer) {
  const yInicio = doc.y + 36;
  textoEnColumna(doc, "Subarrendador", COLUMNA_IZQUIERDA, yInicio, true);
  textoEnColumna(doc, leer("subarrendador", "razonSocial"), COLUMNA_IZQUIERDA, yInicio + 13, true);
  textoEnColumna(doc, "Subarrendatario", COLUMNA_DERECHA, yInicio + 6, true);

  const yLinea = yInicio + 77;
  lineaFirma(doc, COLUMNA_IZQUIERDA, yLinea);
  lineaFirma(doc, COLUMNA_DERECHA, yLinea);
  textoEnColumna(doc, "Representado en este acto por:", COLUMNA_IZQUIERDA, yLinea + 10, false);
  textoEnColumna(doc, leer("subarrendatario", "nombre"), COLUMNA_DERECHA, yLinea + 10, true);
  textoEnColumna(doc, leer("subarrendador", "representante"), COLUMNA_IZQUIERDA, yLinea + 23, true);
  textoEnColumna(doc, "Por propio derecho", COLUMNA_DERECHA, yLinea + 23, false);

  const yObligado = yLinea + 91;
  textoEnColumna(doc, "Obligado Solidario", COLUMNA_IZQUIERDA, yObligado, true);
  const yLineaObligado = yObligado + 68;
  lineaFirma(doc, COLUMNA_IZQUIERDA, yLineaObligado);
  textoEnColumna(doc, leer("obligadoSolidario", "nombre"), COLUMNA_IZQUIERDA, yLineaObligado + 10, true);
  textoEnColumna(doc, "Por propio derecho", COLUMNA_IZQUIERDA, yLineaObligado + 23, false);

  doc.x = MARGEN_IZQUIERDO;
  doc.y = yLineaObligado + 40;
}

function sangriaDeEtiqueta(texto: string): { etiqueta: string; resto: string } | null {
  const plano = textoSinMarcas(texto);
  const coincidencia = /^([A-I]\.)\s+/.exec(plano);
  if (!coincidencia) return null;
  return {
    etiqueta: coincidencia[1],
    resto: texto.replace(/^\*\*[A-I]\.\*\*\s*/, "").replace(/^[A-I]\.\s+/, ""),
  };
}

export function generarPdfSubarrendamiento(
  secciones: SeccionValorPlantillaDto[],
): Promise<Buffer> {
  const leer = crearLector(secciones);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: {
        top: MARGEN_SUPERIOR,
        bottom: MARGEN_INFERIOR,
        left: MARGEN_IZQUIERDO,
        right: MARGEN_DERECHO,
      },
      bufferPages: true,
    });
    doc.registerFont(FUENTE, rutaFuente("Figtree-Regular.ttf"));
    doc.registerFont(FUENTE_NEGRITA, rutaFuente("Figtree-Bold.ttf"));
    doc.lineGap(INTERLINEADO);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const bloques = parrafosContrato({
      t: leer,
      dinero: (seccion, clave) => dinero(leer, seccion, clave),
      fecha: (seccion, clave) => fecha(leer, seccion, clave),
      domicilio: domicilioInmueble(leer),
    });

    let paginaActual = 1;
    bloques.forEach((bloque, indice) => {
      const siguiente = bloques[indice + 1];
      if (bloque.pagina !== paginaActual) {
        doc.addPage();
        paginaActual = bloque.pagina;
      }
      if (bloque.tipo === "seccion" && bloque.texto === "FIRMAS") {
        return;
      }
      if (
        bloque.texto.startsWith("SUBARRENDATARIO\n") ||
        bloque.texto.startsWith("OBLIGADO")
      ) {
        return;
      }
      if (bloque.texto.startsWith("SUBARRENDADOR\n")) {
        dibujarFirmas(doc, leer);
        return;
      }
      if (bloque.tipo === "titulo") {
        doc.y = 74;
        escribirMixto(doc, bloque.texto, {
          align: "center",
          todoNegrita: true,
          subrayado: true,
        });
        doc.moveDown(0.75);
      } else if (bloque.tipo === "seccion") {
        const centrada = esSeccionCentrada(bloque.texto);
        escribirMixto(doc, bloque.texto, {
          align: centrada ? "center" : "left",
          todoNegrita: true,
        });
        const siguienteEsSeccion = siguiente?.tipo === "seccion";
        doc.moveDown(centrada && !siguienteEsSeccion ? 0.75 : 0);
      } else {
        const preambulo = bloque.texto.startsWith("CONTRATO DE SUBARRENDAMIENTO QUE");
        const marcado = marcarNegritas(bloque.texto);
        const sangria = preambulo ? null : sangriaDeEtiqueta(marcado);
        if (sangria) {
          const y = doc.y;
          const x = doc.page.margins.left;
          doc.font(FUENTE_NEGRITA).fontSize(TAMANO);
          const ancho = doc.widthOfString(`${sangria.etiqueta} `);
          doc.text(sangria.etiqueta, x, y, { lineBreak: false, lineGap: INTERLINEADO });
          doc.x = x + ancho;
          doc.y = y;
          escribirMixto(doc, sangria.resto, {
            align: "justify",
            width: doc.page.width - doc.page.margins.right - (x + ancho),
          });
          doc.x = x;
        } else {
          escribirMixto(doc, marcado, {
            align: "justify",
            todoNegrita: preambulo,
            subrayado: preambulo,
          });
        }
        if (preambulo) {
          doc.moveDown(0.45);
        } else if (siguiente && siguiente.pagina === bloque.pagina && siguiente.tipo !== "seccion") {
          doc.moveDown(0.75);
        }
      }
    });

    const folio = leer("documento", "folio");
    const encabezado = `Contrato de arrendamiento - ${folio}`;
    const rango = doc.bufferedPageRange();
    for (let i = 0; i < rango.count; i++) {
      doc.switchToPage(i);
      const margenSuperior = doc.page.margins.top;
      const margenInferior = doc.page.margins.bottom;
      doc.page.margins.top = 0;
      doc.page.margins.bottom = 0;
      doc.font(FUENTE).fontSize(TAMANO).text(encabezado, MARGEN_IZQUIERDO, 42, {
        width: doc.page.width - MARGEN_IZQUIERDO - MARGEN_DERECHO,
        align: "left",
        lineBreak: false,
      });
      doc.font(FUENTE).fontSize(TAMANO).text(
        `${i + 1} de ${rango.count}`,
        MARGEN_IZQUIERDO,
        736,
        {
          width: doc.page.width - MARGEN_IZQUIERDO - MARGEN_DERECHO,
          align: "center",
          lineBreak: false,
        },
      );
      doc.page.margins.top = margenSuperior;
      doc.page.margins.bottom = margenInferior;
    }

    doc.end();
  });
}
