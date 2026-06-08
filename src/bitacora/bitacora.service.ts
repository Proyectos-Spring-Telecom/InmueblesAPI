import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { CreateBitacoraDto } from "./dto/create-bitac ora.dto";
import { BuscarBitacoraDto } from "./dto/buscar-bitacora.dto";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { Bitacora } from "src/entities/Bitacora";
import { ApiResponseCommon } from "src/common/ApiResponse";

const BITACORA_SELECT = `
SELECT
  b.Id AS id,
  b.Modulo AS modulo,
  b.Descripcion AS descripcion,
  b.Accion AS accion,
  b.Query AS query,
  b.FechaCreacion AS fechaCreacion,
  b.Estatus AS estatus,
  b.Error AS error,
  u.Id AS idUsuario,
  u.Nombre AS nombreUsuario,
  u.ApellidoPaterno AS apellidoPaternoUsuario,
  u.ApellidoMaterno AS apellidoMaternoUsuario,
  u.UserName AS UserNameUsuario,
  u.Estatus AS estatusUsuario,
  m.Id AS idModulo,
  m.Nombre AS nombreModulo,
  m.Descripcion AS descripcionModulo
FROM Bitacora b
INNER JOIN Usuarios u ON b.IdUsuario = u.Id
INNER JOIN Modulos m ON b.IdModulo = m.Id`;

function mapBitacoraRows(rows: Record<string, unknown>[]) {
  return rows.map((item) => ({
    ...item,
    id: Number(item.id),
    idUsuario: Number(item.idUsuario),
    idModulo: Number(item.idModulo),
  }));
}

@Injectable()
export class BitacoraService {
     constructor(
    @InjectRepository(Bitacora)
    private readonly bitacoraRepository: Repository<Bitacora>,
  ) {}
  createBitacora(createBitacoraDto: CreateBitacoraDto) {
    return 'This action adds a new bitacora';
  }

  async findAllListBitacora() {
    try {
      const bitacora = await this.bitacoraRepository.query(
        `
SELECT
  -- Bitácora
  b.Id AS id,
  b.Modulo AS modulo,
  b.Descripcion AS descripcion,
  b.Accion AS accion,
  b.Query AS query,
  b.FechaCreacion AS fechaCreacion,
  b.Estatus AS estatus,
  b.Error AS error,

  -- Usuario
  u.Id AS idUsuario,
  u.Nombre AS nombreUsuario,
  u.ApellidoPaterno AS apellidoPaternoUsuario,
  u.ApellidoMaterno AS apellidoMaternoUsuario,
  u.UserName AS UserNameUsuario,
  u.Estatus AS estatusUsuario,

  -- Módulo
  m.Id AS idModulo,
  m.Nombre AS nombreModulo,
  m.Descripcion AS descripcionModulo

FROM Bitacora b
INNER JOIN Usuarios u ON b.IdUsuario = u.Id
INNER JOIN Modulos m ON b.IdModulo = m.Id



ORDER BY b.FechaCreacion DESC;
            `,
      );

      const data = bitacora.map((item) => ({
        ...item,
        id: Number(item.id),
        idUsuario: Number(item.idUsuario),
        idModulo: Number(item.idModulo),
      }));

      const result: ApiResponseCommon = {
        data: data,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Ocurrió un error al obtener las bitácoras listado.');
    }
  }

  async findAllPaginated(dto: BuscarBitacoraDto) {
    try {
      const { page, limit, fechaInicio, fechaFin } = dto;

      if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
        throw new BadRequestException(
          "fechaInicio no puede ser posterior a fechaFin",
        );
      }

      const { whereSql, filterParams } = this.buildFechaRangoClause(
        fechaInicio,
        fechaFin,
      );
      const offset = (page - 1) * limit;

      const bitacora = await this.bitacoraRepository.query(
        `${BITACORA_SELECT}
${whereSql}
ORDER BY b.FechaCreacion DESC
LIMIT ? OFFSET ?`,
        [...filterParams, limit, offset],
      );

      const totalResult = await this.bitacoraRepository.query(
        `SELECT COUNT(*) AS total
FROM Bitacora b
INNER JOIN Usuarios u ON b.IdUsuario = u.Id
INNER JOIN Modulos m ON b.IdModulo = m.Id
${whereSql}`,
        filterParams,
      );

      const total = Number(totalResult[0]?.total ?? 0);

      const result: ApiResponseCommon = {
        data: mapBitacoraRows(bitacora),
        paginated: {
          total,
          page,
          lastPage: total === 0 ? 0 : Math.ceil(total / limit),
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        "Ocurrió un error al obtener las bitácoras paginada.",
      );
    }
  }

  private buildFechaRangoClause(fechaInicio?: string, fechaFin?: string) {
    const conditions: string[] = [];
    const filterParams: string[] = [];

    if (fechaInicio) {
      conditions.push("b.FechaCreacion >= ?");
      filterParams.push(`${fechaInicio} 00:00:00`);
    }
    if (fechaFin) {
      conditions.push("b.FechaCreacion <= ?");
      filterParams.push(`${fechaFin} 23:59:59`);
    }

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    return { whereSql, filterParams };
  }

  async findOne(id: number) {
    try {
      const bitacora = await this.bitacoraRepository.query(
        `
SELECT
  -- Bitácora
  b.Id AS id,
  b.Modulo AS modulo,
  b.Descripcion AS descripcion,
  b.Accion AS accion,
  b.Query AS query,
  b.FechaCreacion AS fechaCreacion,
  b.Estatus AS estatus,
  b.Error AS error,

  -- Usuario
  u.Id AS idUsuario,
  u.Nombre AS nombreUsuario,
  u.ApellidoPaterno AS apellidoPaternoUsuario,
  u.ApellidoMaterno AS apellidoMaternoUsuario,
  u.UserName AS UserNameUsuario,
  u.Estatus AS estatusUsuario,

  -- Módulo
  m.Id AS idModulo,
  m.Nombre AS nombreModulo,
  m.Descripcion AS descripcionModulo

FROM Bitacora b
INNER JOIN Usuarios u ON b.IdUsuario = u.Id
INNER JOIN Modulos m ON b.IdModulo = m.Id

WHERE b.Id = ?

ORDER BY b.FechaCreacion DESC;
            `,
            [id]
      );

      if (bitacora.length === 0) {
        throw new NotFoundException(`Bitácora con ID: ${id} no encontrada.`);
      }

      const data = bitacora.map((item) => ({
        ...item,
        id: Number(item.id),
        idUsuario: Number(item.idUsuario),
        idModulo: Number(item.idModulo),
      }));
      
      return { data: data };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al obtener las bitácoras paginada.',
      });
    }
  }

  async logToBitacora(
    modulo: string,
    descripcion: string,
    accion: string,
    query: object,
    idUsuario: number,
    idModulo: number,
    estatus?: string,
    error?: string,
  ) {
    function pad(n: number) {
      return n < 10 ? '0' + n : n;
    }
    const ahora = new Date();
    const FechaActual = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:${pad(ahora.getSeconds())}`;

    const registro = this.bitacoraRepository.create({
      modulo: modulo,
      descripcion: descripcion,
      accion: accion,
      query: { raw: query },
      estatus: estatus ?? null,
      error: error ?? null,
      idUsuario: idUsuario,
      idModulo: idModulo,
    });
    await this.bitacoraRepository.save(registro);
    console.log('Registro guardado correctamente en la bitácora: ', registro);
  }
}
