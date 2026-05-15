/**
 * Parser para FormData con claves anidadas estilo `arr[0].prop` o `arr[0][prop]`.
 *
 * Multer recibe los campos de texto en `req.body` con las llaves tal cual
 * (`servicios[0].numeroContrato`) y los archivos en `req.files[]` con
 * `file.fieldname` también con la llave original (`servicios[0].archivo`).
 *
 * Este helper toma ambos y devuelve un objeto anidado que se puede pasar a
 * `plainToInstance(Dto, nested)` para validar con `class-validator`.
 */

export function splitKey(key: string): (string | number)[] {
  const tokens: (string | number)[] = [];
  const re = /([^\.\[\]]+)|\[(\d+)\]|\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(key)) !== null) {
    if (m[1] !== undefined) tokens.push(m[1]);
    else if (m[2] !== undefined) tokens.push(Number(m[2]));
    else if (m[3] !== undefined) tokens.push(m[3]);
  }
  return tokens;
}

export function setByPath(
  target: any,
  path: (string | number)[],
  value: any,
): void {
  if (path.length === 0) return;
  let cur = target;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    const nextK = path[i + 1];
    if (cur[k] === undefined || cur[k] === null) {
      cur[k] = typeof nextK === "number" ? [] : {};
    }
    cur = cur[k];
  }
  cur[path[path.length - 1]] = value;
}

export function parseNestedFormData(
  body: Record<string, any> | undefined,
  files: Express.Multer.File[] | undefined,
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(body ?? {})) {
    setByPath(result, splitKey(key), value);
  }
  for (const file of files ?? []) {
    setByPath(result, splitKey(file.fieldname), file);
  }
  return result;
}
