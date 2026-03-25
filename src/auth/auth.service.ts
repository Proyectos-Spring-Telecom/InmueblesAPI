import { BadRequestException, HttpException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { LoginAuthDto } from './dto/login-auth.dto';
import { JwtService } from '@nestjs/jwt';
import { Repository, IsNull } from 'typeorm';
import { Usuarios } from 'src/entities/Usuarios';
import { InjectRepository } from '@nestjs/typeorm';
import { UsuariosPermisos } from 'src/entities/UsuariosPermisos';
import * as bcrypt from 'bcrypt';
import { LoginAuthConfirmacionDto } from './dto/login-confirmacion.dto';
import { MailServiceService } from 'src/mail-service/mail-service.service';
import { EstatusEnumBitcora } from 'src/common/estatus.enums';
import { BitacoraService } from 'src/bitacora/bitacora.service';
import { LoginAuthResetDto } from './dto/login-recuperacion.dto';
import { ConfigService } from '@nestjs/config';
import { RefreshSessions } from 'src/entities/RefreshSessions';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { createHash, randomUUID } from 'crypto';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(Usuarios)
        private readonly usuariosRepository: Repository<Usuarios>,
        @InjectRepository(UsuariosPermisos)
        private readonly permisosRepository: Repository<UsuariosPermisos>,
        @InjectRepository(RefreshSessions)
        private readonly refreshSessionsRepository: Repository<RefreshSessions>,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly mailserviceService: MailServiceService,
        private readonly bitacoraLogger: BitacoraService,
    ) { }

    private hashToken(token: string): string {
        return createHash('sha256').update(token, 'utf8').digest('hex');
    }

    async signIn(loginAuthDto: LoginAuthDto) {

        try {
            const user = await this.usuariosRepository.findOne({
                where: { userName: loginAuthDto.userName, estatus: 1 },
            });
            if (
                !user ||
                !(await bcrypt.compare(loginAuthDto.password, user.passwordHash))
            ) {

                throw new UnauthorizedException('Credenciales invalidas');
            }

            const accessPayload = {
                id: user.id,
                email: user.userName,
                cliente: user.idCliente,
                rol: user.idRol,
                type: 'access' as const,
            };

            function pad(n: number) {
                return n < 10 ? '0' + n : n;
            }
            const ahora = new Date();
            const fechaActual = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:${pad(ahora.getSeconds())}`;

            await this.usuariosRepository.update(user.id, {
                ultimoLogin: fechaActual,
            });

            const token = this.jwtService.sign(accessPayload);
            const jti = randomUUID();
            const refreshPayload = { id: user.id, type: 'refresh' as const, jti };
            const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN');
            const refreshToken = this.jwtService.sign(refreshPayload, {
                expiresIn: refreshExpiresIn as any,
            });
            const decoded = this.jwtService.decode(refreshToken) as { exp: number };
            await this.refreshSessionsRepository.save(
                this.refreshSessionsRepository.create({
                    idUsuario: user.id,
                    jti,
                    tokenHash: this.hashToken(refreshToken),
                    expiresAt: new Date(decoded.exp * 1000),
                    revokedAt: null,
                    replacedById: null,
                }),
            );

            return {
                token,
                refreshToken,
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new InternalServerErrorException(error);
        }
    }

    async refreshTokens(dto: RefreshTokenDto) {
        const secret = this.configService.get<string>('JWT_SECRET');
        let payload: { id?: unknown; type?: string; jti?: string };
        try {
            payload = this.jwtService.verify(dto.refreshToken, { secret });
        } catch {
            throw new UnauthorizedException('Refresh token inválido o expirado');
        }
        if (payload.type !== 'refresh' || typeof payload.jti !== 'string') {
            throw new UnauthorizedException('Token no válido para renovación');
        }
        const userId = Number(payload.id);
        if (!Number.isFinite(userId)) {
            throw new UnauthorizedException('Token no válido para renovación');
        }
        const tokenHash = this.hashToken(dto.refreshToken);
        const session = await this.refreshSessionsRepository.findOne({
            where: { jti: payload.jti, idUsuario: userId },
        });
        if (!session || session.revokedAt || session.tokenHash !== tokenHash) {
            throw new UnauthorizedException('Sesión de refresh inválida o revocada');
        }
        if (new Date(session.expiresAt).getTime() <= Date.now()) {
            throw new UnauthorizedException('Sesión de refresh expirada');
        }
        const user = await this.usuariosRepository.findOne({
            where: { id: userId, estatus: 1 },
        });
        if (!user) {
            throw new UnauthorizedException('Usuario no autorizado');
        }
        const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN');
        const newJti = randomUUID();
        const newRefreshToken = this.jwtService.sign(
            { id: user.id, type: 'refresh' as const, jti: newJti },
            { expiresIn: refreshExpiresIn as any },
        );
        const newDecoded = this.jwtService.decode(newRefreshToken) as { exp: number };
        const accessPayload = {
            id: user.id,
            email: user.userName,
            cliente: user.idCliente,
            rol: user.idRol,
            type: 'access' as const,
        };
        const token = this.jwtService.sign(accessPayload);

        await this.refreshSessionsRepository.manager.transaction(async (manager) => {
            const newRow = manager.create(RefreshSessions, {
                idUsuario: user.id,
                jti: newJti,
                tokenHash: this.hashToken(newRefreshToken),
                expiresAt: new Date(newDecoded.exp * 1000),
                revokedAt: null,
                replacedById: null,
            });
            const saved = await manager.save(RefreshSessions, newRow);
            await manager.update(
                RefreshSessions,
                { id: session.id },
                { revokedAt: new Date(), replacedById: saved.id },
            );
        });

        return { token, refreshToken: newRefreshToken };
    }

    async logoutRefresh(dto: RefreshTokenDto) {
        const secret = this.configService.get<string>('JWT_SECRET');
        let payload: { id?: unknown; type?: string; jti?: string };
        try {
            payload = this.jwtService.verify(dto.refreshToken, { secret });
        } catch {
            throw new UnauthorizedException('Refresh token inválido');
        }
        if (payload.type !== 'refresh' || typeof payload.jti !== 'string') {
            throw new UnauthorizedException('Token no válido');
        }
        const userId = Number(payload.id);
        const tokenHash = this.hashToken(dto.refreshToken);
        const session = await this.refreshSessionsRepository.findOne({
            where: { jti: payload.jti, idUsuario: userId },
        });
        if (session && !session.revokedAt && session.tokenHash === tokenHash) {
            await this.refreshSessionsRepository.update(session.id, { revokedAt: new Date() });
        }
        return { message: 'Sesión cerrada' };
    }

    private async revokeAllRefreshSessionsForUser(userId: number) {
        await this.refreshSessionsRepository.update(
            { idUsuario: userId, revokedAt: IsNull() },
            { revokedAt: new Date() },
        );
    }

    async getProfile(userId: number) {
        try {
            const user = await this.usuariosRepository.findOne({
                relations: ['idRol2', 'idCliente2'],
                where: { id: userId, estatus: 1 },
            });
            if (!user) {
                throw new UnauthorizedException('Usuario no autorizado');
            }

            const permisos = await this.permisosRepository.find({
                select: ['idPermiso'],
                where: { idUsuario: user.id, estatus: 1 },
            });

            return {
                id: Number(`${user.id}`),
                idCliente: Number(`${user.idCliente}`),
                nombre: `${user.nombre}`,
                apellidoPaterno: `${user.apellidoPaterno}`,
                apellidoMaterno: `${user.apellidoMaterno}`,
                telefono: `${user.telefono}`,
                ultimoLogin: `${user.ultimoLogin}`,
                fechaCreacion: `${user.fechaCreacion}`,
                fotoPerfil: `${user.fotoPerfil}`,
                userName: `${user.userName}`,
                rol: user.idRol,
                rolNombre: user.idRol2?.nombre,
                permisos,
                logo: user.idCliente2?.logotipo,
                nombreCliente: user.idCliente2?.nombre,
                apellidoPaternoCliente: user.idCliente2?.apellidoPaterno,
                apellidoMaternoCliente: user.idCliente2?.apellidoMaterno,
                telefonoCliente: user.idCliente2?.telefono,
                emailCliente: user.idCliente2?.correo,
                direccionCliente: user.idCliente2?.calle,
                ciudadCliente: user.idCliente2?.municipio,
                estadoCliente: user.idCliente2?.estado,
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new InternalServerErrorException(error);
        }
    }

    async generateToken(user: { id: number; email: string }) {
        const payload = { id: user.id, email: user.email };
        const token = this.jwtService.sign(payload, {
            secret: process.env.JWT_SECRET,
            expiresIn: (process.env.JWT_CONFIRMACION || '1h') as any,
        });
        return token;
    }


    // ========================================
    //enviar correo para recuperar contraseña
    // ========================================
    async recuperarContrasena(
        loginAuthConfirmacionDto: LoginAuthConfirmacionDto,
    ) {
        try {
            //Buscamos el usuario por correo
            const user = await this.usuariosRepository.findOne({
                where: { userName: loginAuthConfirmacionDto.userName },
            });
            if (!user) throw new BadRequestException('Usuario no encontrado');

            //Generamos el codigo
            /* const codigo = await this.generarCodigo(
              user.id,
              TipoCodigoAutenticacion.RECUPERACION_CONTRASENA,
            );
       */
            //Generamos el payload para el tokenn
            const payload = {
                id: user.id,
                email: user.userName,
            };

            //Generamos el token
            const token = this.jwtService.sign(payload, {
                expiresIn: `${process.env.JWT_CONFIRMACION}`,
            } as any);
            const name = `${user.nombre} ${user.apellidoPaterno} ${user.apellidoMaterno}`;
            await this.mailserviceService.sendResetPasswordEmail(
                user.userName,
                name,
                token,
            );
            return `Se ha enviado un correo con el codigo.`;
        } catch (error) {
            console.log(error);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new InternalServerErrorException({
                message: 'Ocurrió un error al recuperar contraseña del usuario.',
                error: error.message,
            });
        }
    }

    // ========================================
    //actualizar contraseña
    // ========================================
    async resetPassword(loginAuthResetDto: LoginAuthResetDto) {
        try {
            const user = await this.usuariosRepository.findOne({
                where: { userName: loginAuthResetDto.userName },
            });
            if (!user) throw new BadRequestException('Usuario no encontrado');

            const hashedPassword = await bcrypt.hash(loginAuthResetDto.password, 10); //encriptamos la contraseña
            loginAuthResetDto.password = hashedPassword;
            await this.usuariosRepository.update(user.id, {
                passwordHash: hashedPassword,
            });
            await this.revokeAllRefreshSessionsForUser(user.id);
            //-----Registro en la bitacora----- SUCCESS
            const querylogger = { id: user.id, EmailConfirmado: 1 };
            await this.bitacoraLogger.logToBitacora(
                'Usuarios',
                `Se actualizo la contraseña del usuarios con ID: ${user.id}`,
                'CREATE',
                querylogger,
                Number(user.id),
                2,
                EstatusEnumBitcora.SUCCESS,
            );
            return `La contraseña del usuario ${user.nombre} ha sido actualizada exitosamente.`;
        } catch (error) {
            console.log(error);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new InternalServerErrorException({
                message: 'Ocurrió un error al actualizar contraseña del usuario.',
                error: error.message,
            });
        }
    }

}
