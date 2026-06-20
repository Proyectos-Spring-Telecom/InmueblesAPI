import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BitacoraService } from "src/bitacora/bitacora.service";
import { EstatusEnumBitcora } from "src/common/ApiResponse";
import { Formulas } from "src/entities/Formulas";
import { Factores } from "src/entities/Factores";
import { FormulaEvaluaciones } from "src/entities/FormulaEvaluaciones";
import { EvaluarFormulaDto } from "./dto/evaluar-formula.dto";

interface ParseResult {
  valor: number;
  pos: number;
}

@Injectable()
export class FormulaEngineService {
  constructor(
    @InjectRepository(Formulas)
    private readonly formulasRepository: Repository<Formulas>,
    @InjectRepository(Factores)
    private readonly factoresRepository: Repository<Factores>,
    @InjectRepository(FormulaEvaluaciones)
    private readonly evaluacionRepository: Repository<FormulaEvaluaciones>,
    private readonly bitacoraLogger: BitacoraService,
  ) { }

  async evaluar(
    dto: EvaluarFormulaDto,
    req: any,
    guardarAuditoria = true,
  ) {
    const formula = await this.formulasRepository.findOne({
      where: { id: dto.idFormula, estatus: 1 },
    });
    if (!formula) {
      throw new NotFoundException("Fórmula no encontrada");
    }

    if (!formula.formula?.trim()) {
      throw new BadRequestException("La fórmula no tiene expresión definida");
    }

    const valoresResueltos = await this.resolverVariables(formula.formula);

    let expresionFinal = formula.formula;
    const nombresOrdenados = Object.keys(valoresResueltos).sort(
      (a, b) => b.length - a.length,
    );
    for (const nombre of nombresOrdenados) {
      const regex = new RegExp(`\\b${this.escapeRegex(nombre)}\\b`, "gi");
      expresionFinal = expresionFinal.replace(
        regex,
        valoresResueltos[nombre].toString(),
      );
    }

    const resultado = this.evaluarExpresion(expresionFinal);

    if (guardarAuditoria) {
      const evaluacion = this.evaluacionRepository.create({
        idFormula: formula.id,
        idContrato: dto.idContrato ?? null,
        idArrendatario: dto.idArrendatario ?? null,
        variablesUsadas: JSON.stringify(valoresResueltos),
        expresionFinal,
        resultado: String(resultado),
        mesAplicacion: new Date(),
      });
      await this.evaluacionRepository.save(evaluacion);
    }

    const idUser = Number(req?.user?.userId || 0);
    await this.bitacoraLogger.logToBitacora(
      "Formulas",
      `Fórmula evaluada: ${formula.nombre}. Resultado: ${resultado}.`,
      "EVALUATE",
      { dto, variables: valoresResueltos, resultado },
      idUser,
      1,
      EstatusEnumBitcora.SUCCESS,
    );

    return {
      idFormula: formula.id,
      nombreFormula: formula.nombre,
      expresionOriginal: formula.formula,
      expresionSustituida: expresionFinal,
      variables: valoresResueltos,
      resultado,
      tipoResultado: formula.tipoResultado,
    };
  }

  preview(dto: EvaluarFormulaDto, req: any) {
    return this.evaluar(dto, req, false);
  }

  historial(idFormula?: number, idContrato?: number) {
    const qb = this.evaluacionRepository.createQueryBuilder("e");
    if (idFormula != null) {
      qb.andWhere("e.idFormula = :idFormula", { idFormula });
    }
    if (idContrato != null) {
      qb.andWhere("e.idContrato = :idContrato", { idContrato });
    }
    return qb.orderBy("e.fhRegistro", "DESC").limit(50).getMany();
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private extractFormulaIdentifiers(formula: string): string[] {
    return [
      ...new Set(formula.toUpperCase().match(/[A-Z_][A-Z0-9_]*/g) ?? []),
    ];
  }

  private normalizarVariable(value: string): string {
    return value.trim().toUpperCase();
  }

  private findFactor(factores: Factores[], nombre: string): Factores | undefined {
    const key = this.normalizarVariable(nombre);
    return factores.find(
      (f) => f.variable && this.normalizarVariable(f.variable) === key,
    );
  }

  private async resolverVariables(
    formulaText: string,
  ): Promise<Record<string, number>> {
    const identifiers = this.extractFormulaIdentifiers(formulaText);
    if (identifiers.length === 0) {
      throw new BadRequestException("La fórmula no contiene variables");
    }

    const factores = await this.factoresRepository.find({
      where: { estatus: 1 },
    });

    const valoresResueltos: Record<string, number> = {};
    const faltantes: string[] = [];

    for (const nombre of identifiers) {
      const factor = this.findFactor(factores, nombre);
      if (!factor) {
        faltantes.push(nombre);
        continue;
      }
      valoresResueltos[nombre] = this.resolveFactorNumericValue(factor);
    }


    if (faltantes.length > 0) {
      const disponibles = factores
        .map((f) => f.variable)
        .filter((v): v is string => Boolean(v?.trim()))
        .join(", ");

      throw new BadRequestException(
        `No se encontraron factores: ${faltantes.join(", ")}. ` +
        `Factores activos disponibles: ${disponibles || "(ninguno)"}.`,
      );
    }

    return valoresResueltos;
  }

  private resolveFactorNumericValue(factor: Factores): number {
    if (factor.valor == null || factor.valor.trim() === "") {
      throw new BadRequestException(
        `El factor "${factor.variable}" no tiene un valor numérico válido.`,
      );
    }

    const num = Number.parseFloat(factor.valor);
    if (!Number.isFinite(num)) {
      throw new BadRequestException(
        `El factor "${factor.variable}" no tiene un valor numérico válido: "${factor.valor}"`,
      );
    }

    return num;
  }

  private evaluarExpresion(expr: string): number {
    const trimmed = expr.replace(/\s/g, "");
    if (!trimmed.length) {
      throw new BadRequestException("Expresión vacía");
    }
    if (!/^[\d+\-*/().]+$/.test(trimmed)) {
      throw new BadRequestException("Expresión contiene caracteres no permitidos");
    }
    if (!this.parentesisBalanceados(trimmed)) {
      throw new BadRequestException("Paréntesis desbalanceados");
    }

    const result = this.parseExpresion(trimmed, 0);
    if (result.pos !== trimmed.length) {
      throw new BadRequestException("Expresión inválida");
    }
    return result.valor;
  }

  private parentesisBalanceados(expr: string): boolean {
    let depth = 0;
    for (const ch of expr) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (depth < 0) return false;
    }
    return depth === 0;
  }

  private parseExpresion(expr: string, pos: number): ParseResult {
    let current = this.parseTermino(expr, pos);
    pos = current.pos;
    let valor = current.valor;

    while (pos < expr.length && (expr[pos] === "+" || expr[pos] === "-")) {
      const op = expr[pos];
      pos++;
      const right = this.parseTermino(expr, pos);
      pos = right.pos;
      valor = op === "+" ? valor + right.valor : valor - right.valor;
    }

    return { valor, pos };
  }

  private parseTermino(expr: string, pos: number): ParseResult {
    let current = this.parseFactor(expr, pos);
    pos = current.pos;
    let valor = current.valor;

    while (pos < expr.length && (expr[pos] === "*" || expr[pos] === "/")) {
      const op = expr[pos];
      pos++;
      const right = this.parseFactor(expr, pos);
      pos = right.pos;
      if (op === "/" && right.valor === 0) {
        throw new BadRequestException("División entre cero");
      }
      valor = op === "*" ? valor * right.valor : valor / right.valor;
    }

    return { valor, pos };
  }

  private parseFactor(expr: string, pos: number): ParseResult {
    if (pos >= expr.length) {
      throw new BadRequestException("Expresión inválida");
    }

    if (expr[pos] === "-") {
      const inner = this.parseFactor(expr, pos + 1);
      return { valor: -inner.valor, pos: inner.pos };
    }

    if (expr[pos] === "+") {
      return this.parseFactor(expr, pos + 1);
    }

    if (expr[pos] === "(") {
      const inner = this.parseExpresion(expr, pos + 1);
      if (inner.pos >= expr.length || expr[inner.pos] !== ")") {
        throw new BadRequestException("Paréntesis desbalanceados");
      }
      return { valor: inner.valor, pos: inner.pos + 1 };
    }

    const start = pos;
    if (expr[pos] === ".") {
      pos++;
    }
    while (pos < expr.length && (/\d/.test(expr[pos]) || expr[pos] === ".")) {
      pos++;
    }

    if (start === pos) {
      throw new BadRequestException("Expresión inválida");
    }

    const num = Number.parseFloat(expr.substring(start, pos));
    if (!Number.isFinite(num)) {
      throw new BadRequestException("Número inválido en la expresión");
    }

    return { valor: num, pos };
  }
}
