import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Clientes } from 'src/entities/Clientes';
import { Usuarios } from 'src/entities/Usuarios';

type UsuarioResumen = {
  id: number;
  userName: string;
  nombre: string | null;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  telefono: string | null;
  estatus: number;
  idRol: number;
  ultimoLogin: string | null;
};

type UsuarioResumenCorto = {
  id: number;
  userName: string;
  nombre: string | null;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  estatus: number;
  idRol: number;
};

@Injectable()
export class AiToolsService {
  private static readonly DEFAULT_LIMIT = 50;
  private static readonly MAX_LIMIT = 200;

  constructor(
    @InjectRepository(Clientes)
    private readonly clienteRepo: Repository<Clientes>,
    @InjectRepository(Usuarios)
    private readonly usuarioRepo: Repository<Usuarios>,
  ) {}

  private normalizeLimit(limit?: number): number {
    if (limit === undefined || limit === null || Number.isNaN(limit)) {
      return AiToolsService.DEFAULT_LIMIT;
    }
    const n = Math.floor(Number(limit));
    if (n < 1) return 1;
    if (n > AiToolsService.MAX_LIMIT) return AiToolsService.MAX_LIMIT;
    return n;
  }

  private toOptionalInt(value: number | undefined): number | undefined {
    if (value === undefined || value === null) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }

  private mapUsuarioResumen(u: Usuarios): UsuarioResumen {
    return {
      id: u.id,
      userName: u.userName,
      nombre: u.nombre,
      apellidoPaterno: u.apellidoPaterno,
      apellidoMaterno: u.apellidoMaterno,
      telefono: u.telefono,
      estatus: u.estatus,
      idRol: u.idRol,
      ultimoLogin: u.ultimoLogin,
    };
  }

  private mapUsuarioResumenCorto(u: Usuarios): UsuarioResumenCorto {
    return {
      id: u.id,
      userName: u.userName,
      nombre: u.nombre,
      apellidoPaterno: u.apellidoPaterno,
      apellidoMaterno: u.apellidoMaterno,
      estatus: u.estatus,
      idRol: u.idRol,
    };
  }

  async getClientes(estatus?: number, limit?: number) {
    const where: FindOptionsWhere<Clientes> = {};
    const est = this.toOptionalInt(estatus);
    if (est !== undefined) {
      where.estatus = est;
    }

    const take = this.normalizeLimit(limit);
    const clientes = await this.clienteRepo.find({
      where,
      take,
      order: { fechaCreacion: 'DESC' },
      select: [
        'id',
        'rfc',
        'tipoPersona',
        'nombre',
        'apellidoPaterno',
        'apellidoMaterno',
        'telefono',
        'correo',
        'estado',
        'municipio',
        'estatus',
        'fechaCreacion',
      ],
    });

    return {
      status: 'success',
      message: `${clientes.length} clientes encontrados`,
      data: clientes,
    };
  }

  async getClienteById(id: number) {
    const cliente = await this.clienteRepo.findOne({
      where: { id },
      relations: ['usuarios', 'equipos', 'instalaciones', 'departamentos'],
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    const usuariosLimpios =
      cliente.usuarios?.map((u) => this.mapUsuarioResumen(u)) ?? [];

    return {
      status: 'success',
      message: 'Cliente encontrado',
      data: {
        id: cliente.id,
        rfc: cliente.rfc,
        tipoPersona: cliente.tipoPersona,
        nombre: cliente.nombre,
        apellidoPaterno: cliente.apellidoPaterno,
        apellidoMaterno: cliente.apellidoMaterno,
        telefono: cliente.telefono,
        correo: cliente.correo,
        sitioWeb: cliente.sitioWeb,
        estado: cliente.estado,
        municipio: cliente.municipio,
        colonia: cliente.colonia,
        calle: cliente.calle,
        numeroExterior: cliente.numeroExterior,
        cp: cliente.cp,
        nombreEncargado: cliente.nombreEncargado,
        telefonoEncargado: cliente.telefonoEncargado,
        correoEncargado: cliente.correoEncargado,
        estatus: cliente.estatus,
        fechaCreacion: cliente.fechaCreacion,
        idPadre: cliente.idPadre,
        totalUsuarios: usuariosLimpios.length,
        usuariosActivos: usuariosLimpios.filter((u) => u.estatus === 1).length,
        totalEquipos: cliente.equipos?.length ?? 0,
        totalInstalaciones: cliente.instalaciones?.length ?? 0,
        totalDepartamentos: cliente.departamentos?.length ?? 0,
        usuarios: usuariosLimpios,
      },
    };
  }

  async getClienteByRfc(rfc: string) {
    const cliente = await this.clienteRepo.findOne({
      where: { rfc: rfc.trim().toUpperCase() },
      relations: ['usuarios'],
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con RFC ${rfc} no encontrado`);
    }

    const usuariosLimpios =
      cliente.usuarios?.map((u) => this.mapUsuarioResumenCorto(u)) ?? [];

    return {
      status: 'success',
      message: 'Cliente encontrado',
      data: {
        id: cliente.id,
        rfc: cliente.rfc,
        tipoPersona: cliente.tipoPersona,
        nombre: cliente.nombre,
        apellidoPaterno: cliente.apellidoPaterno,
        apellidoMaterno: cliente.apellidoMaterno,
        telefono: cliente.telefono,
        correo: cliente.correo,
        estado: cliente.estado,
        municipio: cliente.municipio,
        estatus: cliente.estatus,
        totalUsuarios: usuariosLimpios.length,
        usuarios: usuariosLimpios,
      },
    };
  }

  async getUsuarios(estatus?: number, clienteId?: number, limit?: number) {
    const where: FindOptionsWhere<Usuarios> = {};
    const est = this.toOptionalInt(estatus);
    const cli = this.toOptionalInt(clienteId);
    if (est !== undefined) {
      where.estatus = est;
    }
    if (cli !== undefined) {
      where.idCliente = cli;
    }

    const take = this.normalizeLimit(limit);
    const usuarios = await this.usuarioRepo.find({
      where,
      take,
      order: { fechaCreacion: 'DESC' },
      relations: ['idCliente2', 'idRol2'],
    });

    const data = usuarios.map((u) => ({
      id: u.id,
      userName: u.userName,
      nombre: u.nombre,
      apellidoPaterno: u.apellidoPaterno,
      apellidoMaterno: u.apellidoMaterno,
      telefono: u.telefono,
      estatus: u.estatus,
      ultimoLogin: u.ultimoLogin,
      fechaCreacion: u.fechaCreacion,
      idRol: u.idRol,
      rolNombre: u.idRol2?.nombre ?? null,
      idCliente: u.idCliente,
      clienteNombre: u.idCliente2?.nombre ?? null,
    }));

    return {
      status: 'success',
      message: `${data.length} usuarios encontrados`,
      data,
    };
  }

  async getUsuarioById(id: number) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id },
      relations: ['idCliente2', 'idRol2'],
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return {
      status: 'success',
      message: 'Usuario encontrado',
      data: {
        id: usuario.id,
        userName: usuario.userName,
        nombre: usuario.nombre,
        apellidoPaterno: usuario.apellidoPaterno,
        apellidoMaterno: usuario.apellidoMaterno,
        telefono: usuario.telefono,
        emailConfirmado: usuario.emailConfirmado,
        estatus: usuario.estatus,
        ultimoLogin: usuario.ultimoLogin,
        fechaCreacion: usuario.fechaCreacion,
        fechaActualizacion: usuario.fechaActualizacion,
        idRol: usuario.idRol,
        rolNombre: usuario.idRol2?.nombre ?? null,
        idCliente: usuario.idCliente,
        clienteNombre: usuario.idCliente2?.nombre ?? null,
        clienteRfc: usuario.idCliente2?.rfc ?? null,
      },
    };
  }

  async getUsuariosByCliente(clienteId: number) {
    const usuarios = await this.usuarioRepo.find({
      where: { idCliente: clienteId },
      relations: ['idRol2'],
      order: { fechaCreacion: 'DESC' },
    });

    const data = usuarios.map((u) => ({
      id: u.id,
      userName: u.userName,
      nombre: u.nombre,
      apellidoPaterno: u.apellidoPaterno,
      apellidoMaterno: u.apellidoMaterno,
      telefono: u.telefono,
      estatus: u.estatus,
      ultimoLogin: u.ultimoLogin,
      idRol: u.idRol,
      rolNombre: u.idRol2?.nombre ?? null,
    }));

    return {
      status: 'success',
      message: `${data.length} usuarios del cliente ${clienteId}`,
      data,
    };
  }
}
