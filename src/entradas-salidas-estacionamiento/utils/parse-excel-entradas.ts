import { BadRequestException } from "@nestjs/common";
import * as XLSX from "xlsx";

const REQUIRED_HEADERS = ["boleto", "fechae", "fechap", "total"] as const;

export type ExcelEntradaSalidaRow = {
  boleto: string | null;
  fechaEntrada: Date | null;
  fechaSalida: Date | null;
  total: string | null;
};

export type ParseEntradasSalidasResult = {
  rows: ExcelEntradaSalidaRow[];
  advertencias: string[];
  filasOmitidas: number;
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function parseExcelDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(
        parsed.y,
        parsed.m - 1,
        parsed.d,
        parsed.H ?? 0,
        parsed.M ?? 0,
        parsed.S ?? 0,
      );
    }
  }
  const text = String(value).trim();
  if (!text) return null;
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseTotal(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  let text = String(value).trim();
  if (!text) return null;

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1).trim();
  }

  text = text
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .replace(/^(mxn|usd)\s*/i, "")
    .replace(/[$€£¥₹]/g, "");

  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  }

  const n = Number(text);
  if (!Number.isFinite(n)) {
    return null;
  }

  return String(negative ? -n : n);
}

function isEmptyRow(values: unknown[]): boolean {
  return values.every(
    (v) => v === undefined || v === null || String(v).trim() === "",
  );
}

export function parseEntradasSalidasExcel(buffer: Buffer): ParseEntradasSalidasResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    throw new BadRequestException(
      "No se pudo leer el archivo Excel. Verifique el formato (.xlsx o .xls).",
    );
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new BadRequestException("El archivo Excel no contiene hojas.");
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  }) as unknown[][];

  if (!matrix.length) {
    throw new BadRequestException("El archivo Excel está vacío.");
  }

  const headerRowIndex = matrix.findIndex(
    (row) =>
      Array.isArray(row) &&
      REQUIRED_HEADERS.every((h) =>
        row.some((cell) => normalizeHeader(cell) === h),
      ),
  );

  if (headerRowIndex < 0) {
    throw new BadRequestException(
      "Cabeceras requeridas: Boleto, FechaE, FechaP, Total.",
    );
  }

  const headerRow = matrix[headerRowIndex] as unknown[];
  const colIndex: Record<(typeof REQUIRED_HEADERS)[number], number> = {
    boleto: -1,
    fechae: -1,
    fechap: -1,
    total: -1,
  };

  headerRow.forEach((cell, idx) => {
    const key = normalizeHeader(cell) as (typeof REQUIRED_HEADERS)[number];
    if (REQUIRED_HEADERS.includes(key)) {
      colIndex[key] = idx;
    }
  });

  const rows: ExcelEntradaSalidaRow[] = [];
  const advertencias: string[] = [];
  let filasOmitidas = 0;

  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!Array.isArray(row) || isEmptyRow(row)) continue;

    const boletoRaw = row[colIndex.boleto];
    const boleto =
      boletoRaw === undefined || boletoRaw === null
        ? null
        : String(boletoRaw).trim() || null;

    const fechaEntrada = parseExcelDate(row[colIndex.fechae]);
    const fechaSalida = parseExcelDate(row[colIndex.fechap]);
    const total = parseTotal(row[colIndex.total]);

    if (!boleto) {
      filasOmitidas++;
      advertencias.push(`Fila ${i + 1}: omitida (Boleto vacío).`);
      continue;
    }

    rows.push({ boleto, fechaEntrada, fechaSalida, total });
  }

  if (rows.length === 0) {
    throw new BadRequestException(
      filasOmitidas > 0
        ? "No hay filas válidas para importar. Revise que la columna Boleto tenga valor."
        : "No hay filas de datos después de la cabecera.",
    );
  }

  return { rows, advertencias: advertencias.slice(0, 20), filasOmitidas };
}
