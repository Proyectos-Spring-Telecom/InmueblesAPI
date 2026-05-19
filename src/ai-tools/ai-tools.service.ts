import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Clientes } from 'src/entities/Clientes';
import { Usuarios } from 'src/entities/Usuarios';
import { Inmuebles } from 'src/entities/Inmuebles';
import { Arrendatarios } from 'src/entities/Arrendatarios';
import { ContratoArrendatarios } from 'src/entities/ContratoArrendatarios';
import { Pago } from 'src/entities/Pago';
import { Inpc } from 'src/entities/Inpc';
import { Factores } from 'src/entities/Factores';
import { Formulas } from 'src/entities/Formulas';

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
    @InjectRepository(Inmuebles)
    private readonly inmuebleRepo: Repository<Inmuebles>,
    @InjectRepository(Arrendatarios)
    private readonly arrendatarioRepo: Repository<Arrendatarios>,
    @InjectRepository(ContratoArrendatarios)
    private readonly contratoRepo: Repository<ContratoArrendatarios>,
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    @InjectRepository(Inpc)
    private readonly inpcRepo: Repository<Inpc>,
    @InjectRepository(Factores)
    private readonly factorRepo: Repository<Factores>,
    @InjectRepository(Formulas)
    private readonly formulaRepo: Repository<Formulas>,
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

  // ─── INMUEBLES ───

  async getInmuebles(idArrendador?: number, estatus?: number, limit?: number) {
    const where: FindOptionsWhere<Inmuebles> = {};
    const arr = this.toOptionalInt(idArrendador);
    const est = this.toOptionalInt(estatus);
    if (arr !== undefined) where.idArrendador = arr;
    if (est !== undefined) where.estatus = est;

    const inmuebles = await this.inmuebleRepo.find({
      where,
      take: this.normalizeLimit(limit),
      order: { fhRegistro: 'DESC' },
      relations: ['arrendador', 'zonas'],
    });

    return {
      status: 'success',
      message: `${inmuebles.length} inmuebles encontrados`,
      data: inmuebles.map((i) => ({
        id: i.id,
        inmueble: i.inmueble,
        direccionFiscal: i.direccionFiscal,
        estatusInmueble: i.estatusInmueble,
        vigenciaAnios: i.vigenciaAnios,
        fechaInicio: i.fechaInicio,
        fechaFin: i.fechaFin,
        nombreRepresentante: i.nombreRepresentante,
        estatus: i.estatus,
        arrendadorNombre: i.arrendador?.nombre ?? null,
        arrendadorId: i.idArrendador,
        totalZonas: i.zonas?.length ?? 0,
      })),
    };
  }

  async getInmuebleById(id: number) {
    const inmueble = await this.inmuebleRepo.findOne({
      where: { id },
      relations: ['arrendador', 'zonas', 'servicios', 'servicios.tipoServicio'],
    });
    if (!inmueble) {
      throw new NotFoundException(`Inmueble con ID ${id} no encontrado`);
    }

    return {
      status: 'success',
      message: 'Inmueble encontrado',
      data: {
        id: inmueble.id,
        inmueble: inmueble.inmueble,
        direccionFiscal: inmueble.direccionFiscal,
        estatusInmueble: inmueble.estatusInmueble,
        vigenciaAnios: inmueble.vigenciaAnios,
        fechaInicio: inmueble.fechaInicio,
        fechaFin: inmueble.fechaFin,
        nombreRepresentante: inmueble.nombreRepresentante,
        telefonoRepresentante: inmueble.telefonoRepresentante,
        correoRepresentante: inmueble.correoRepresentante,
        lat: inmueble.lat,
        lng: inmueble.lng,
        estatus: inmueble.estatus,
        arrendadorId: inmueble.idArrendador,
        arrendadorNombre: inmueble.arrendador?.nombre ?? null,
        zonas:
          inmueble.zonas?.map((z) => ({
            id: z.id,
            zonaPrincipal: z.zonaPrincipal,
            superficieZonaM2: z.superficieZonaM2,
            superficieDisponibleM2: z.superficieDisponibleM2,
            numeroZona: z.numeroZona,
          })) ?? [],
        servicios:
          inmueble.servicios?.map((s) => ({
            id: s.id,
            tipoServicio: s.tipoServicio?.nombre ?? null,
            numeroContrato: s.numeroContrato,
            fechaPago: s.fechaPago,
            ultimoDiaPago: s.ultimoDiaPago,
          })) ?? [],
      },
    };
  }

  // ─── ARRENDATARIOS ───

  async getArrendatarios(
    idArrendador?: number,
    estatus?: number,
    limit?: number,
  ) {
    const where: FindOptionsWhere<Arrendatarios> = {};
    const arr = this.toOptionalInt(idArrendador);
    const est = this.toOptionalInt(estatus);
    if (arr !== undefined) where.idArrendador = arr;
    if (est !== undefined) where.estatus = est;

    const arrendatarios = await this.arrendatarioRepo.find({
      where,
      take: this.normalizeLimit(limit),
      order: { fhRegistro: 'DESC' },
      relations: ['arrendador'],
    });

    return {
      status: 'success',
      message: `${arrendatarios.length} arrendatarios encontrados`,
      data: arrendatarios.map((a) => ({
        id: a.id,
        arrendatario: a.arrendatario,
        tipoPersona: a.tipoPersona,
        renta: a.renta,
        fechaInicio: a.fechaInicio,
        fechaFin: a.fechaFin,
        tiempoRenta: a.tiempoRenta,
        representanteLegal: a.representanteLegal,
        estatus: a.estatus,
        arrendadorId: a.idArrendador,
        arrendadorNombre: a.arrendador?.nombre ?? null,
      })),
    };
  }

  async getArrendatarioById(id: number) {
    const a = await this.arrendatarioRepo.findOne({
      where: { id },
      relations: [
        'arrendador',
        'contratos',
        'contratos.inmueble',
        'socios',
        'servicios',
        'servicios.tipoServicio',
      ],
    });
    if (!a) {
      throw new NotFoundException(`Arrendatario con ID ${id} no encontrado`);
    }

    return {
      status: 'success',
      message: 'Arrendatario encontrado',
      data: {
        id: a.id,
        arrendatario: a.arrendatario,
        tipoPersona: a.tipoPersona,
        renta: a.renta,
        fechaInicio: a.fechaInicio,
        fechaFin: a.fechaFin,
        tiempoRenta: a.tiempoRenta,
        representanteLegal: a.representanteLegal,
        telefonoRepresentante: a.telefonoRepresentante,
        correoRepresentante: a.correoRepresentante,
        estatus: a.estatus,
        arrendadorId: a.idArrendador,
        arrendadorNombre: a.arrendador?.nombre ?? null,
        totalContratos: a.contratos?.length ?? 0,
        contratos:
          a.contratos?.map((c) => ({
            id: c.id,
            inmuebleNombre: c.inmueble?.inmueble ?? null,
            fechaInicioContrato: c.fechaInicioContrato,
            fechaTerminoContrato: c.fechaTerminoContrato,
            rentaTotal: c.rentaTotal,
            estatus: c.estatus,
          })) ?? [],
        totalSocios: a.socios?.length ?? 0,
        socios:
          a.socios?.map((s) => ({
            id: s.id,
            nombre: s.nombre,
            rfc: s.rfc,
            estatus: s.estatus,
          })) ?? [],
      },
    };
  }

  // ─── CONTRATOS ───

  async getContratos(
    idArrendatario?: number,
    idInmueble?: number,
    estatus?: number,
    limit?: number,
  ) {
    const where: FindOptionsWhere<ContratoArrendatarios> = {};
    const idArr = this.toOptionalInt(idArrendatario);
    const idInm = this.toOptionalInt(idInmueble);
    const est = this.toOptionalInt(estatus);
    if (idArr !== undefined) where.idArrendatario = idArr;
    if (idInm !== undefined) where.idInmueble = idInm;
    if (est !== undefined) where.estatus = est;

    const contratos = await this.contratoRepo.find({
      where,
      take: this.normalizeLimit(limit),
      order: { fhRegistro: 'DESC' },
      relations: ['arrendatario', 'inmueble'],
    });

    return {
      status: 'success',
      message: `${contratos.length} contratos encontrados`,
      data: contratos.map((c) => ({
        id: c.id,
        arrendatarioNombre: c.arrendatario?.arrendatario ?? null,
        inmuebleNombre: c.inmueble?.inmueble ?? null,
        fechaInicioContrato: c.fechaInicioContrato,
        fechaTerminoContrato: c.fechaTerminoContrato,
        moneda: c.moneda,
        metrosRentados: c.metrosRentados,
        costoM2: c.costoM2,
        rentaTotal: c.rentaTotal,
        mantenimientoTotal: c.mantenimientoTotal,
        estatus: c.estatus,
      })),
    };
  }

  async getContratoById(id: number) {
    const c = await this.contratoRepo.findOne({
      where: { id },
      relations: ['arrendatario', 'inmueble'],
    });
    if (!c) {
      throw new NotFoundException(`Contrato con ID ${id} no encontrado`);
    }

    return {
      status: 'success',
      message: 'Contrato encontrado',
      data: {
        id: c.id,
        arrendatarioId: c.idArrendatario,
        arrendatarioNombre: c.arrendatario?.arrendatario ?? null,
        inmuebleId: c.idInmueble,
        inmuebleNombre: c.inmueble?.inmueble ?? null,
        fechaInicioContrato: c.fechaInicioContrato,
        fechaTerminoContrato: c.fechaTerminoContrato,
        moneda: c.moneda,
        metrosRentados: c.metrosRentados,
        costoM2: c.costoM2,
        porcentajeMantenimiento: c.porcentajeMantenimiento,
        mesesDeposito: c.mesesDeposito,
        montoDeposito: c.montoDeposito,
        mesesAdelanto: c.mesesAdelanto,
        montoAdelanto: c.montoAdelanto,
        aniosForzososArrendador: c.aniosForzososArrendador,
        aniosForzososArrendatario: c.aniosForzososArrendatario,
        subTotalRenta: c.subTotalRenta,
        ivaRenta: c.ivaRenta,
        rentaTotal: c.rentaTotal,
        subTotalMantenimiento: c.subTotalMantenimiento,
        ivaMantenimiento: c.ivaMantenimiento,
        mantenimientoTotal: c.mantenimientoTotal,
        observaciones: c.observaciones,
        estatus: c.estatus,
      },
    };
  }

  // ─── PAGOS ───

  async getPagos(idInmueble?: number, estatus?: number, limit?: number) {
    const where: FindOptionsWhere<Pago> = {};
    const idInm = this.toOptionalInt(idInmueble);
    const est = this.toOptionalInt(estatus);
    if (idInm !== undefined) where.idInmueble = idInm;
    if (est !== undefined) where.estatus = est;

    const pagos = await this.pagoRepo.find({
      where,
      take: this.normalizeLimit(limit),
      order: { fhRegistro: 'DESC' },
      relations: ['inmueble', 'metodoPago'],
    });

    return {
      status: 'success',
      message: `${pagos.length} pagos encontrados`,
      data: pagos.map((p) => ({
        id: p.id,
        concepto: p.concepto,
        fechaPago: p.fechaPago,
        monto: p.monto,
        metodoPago: p.metodoPago?.nombre ?? null,
        inmuebleNombre: p.inmueble?.inmueble ?? null,
        estatus: p.estatus,
        estatusTexto:
          p.estatus === 2
            ? 'Pendiente'
            : p.estatus === 1
              ? 'Pagado'
              : 'Cancelado',
      })),
    };
  }

  async getPagosResumen(idInmueble: number) {
    const pagos = await this.pagoRepo.find({
      where: { idInmueble },
      relations: ['inmueble'],
    });

    const totalPagado = pagos
      .filter((p) => p.estatus === 1)
      .reduce((s, p) => s + parseFloat(p.monto || '0'), 0);
    const totalPendiente = pagos
      .filter((p) => p.estatus === 2)
      .reduce((s, p) => s + parseFloat(p.monto || '0'), 0);

    return {
      status: 'success',
      message: `Resumen de pagos del inmueble ${idInmueble}`,
      data: {
        inmuebleId: idInmueble,
        inmuebleNombre: pagos[0]?.inmueble?.inmueble ?? null,
        totalRegistros: pagos.length,
        pagados: pagos.filter((p) => p.estatus === 1).length,
        pendientes: pagos.filter((p) => p.estatus === 2).length,
        cancelados: pagos.filter((p) => p.estatus === 0).length,
        montoTotalPagado: totalPagado,
        montoTotalPendiente: totalPendiente,
      },
    };
  }

  // ─── INPC ───

  async getInpc(anio?: number, limit?: number) {
    const where: FindOptionsWhere<Inpc> = { estatus: 1 };
    const anioFilter = this.toOptionalInt(anio);
    if (anioFilter !== undefined) where.anio = anioFilter;

    const registros = await this.inpcRepo.find({
      where,
      take: this.normalizeLimit(limit),
      order: { anio: 'DESC', mes: 'DESC' },
    });

    return {
      status: 'success',
      message: `${registros.length} registros INPC`,
      data: registros,
    };
  }

  // ─── FACTORES ───

  async getFactores() {
    const factores = await this.factorRepo.find({ where: { estatus: 1 } });
    return {
      status: 'success',
      message: `${factores.length} factores`,
      data: factores,
    };
  }

  // ─── FORMULAS ───

  async getFormulas() {
    const formulas = await this.formulaRepo.find({ where: { estatus: 1 } });
    return {
      status: 'success',
      message: `${formulas.length} fórmulas`,
      data: formulas,
    };
  }
}
