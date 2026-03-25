import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { Usuarios } from 'src/entities/Usuarios';
import { UsuariosPermisos } from 'src/entities/UsuariosPermisos';
import { RefreshSessions } from 'src/entities/RefreshSessions';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { MailServiceModule } from 'src/mail-service/mail-service.module';


@Module({
  imports: [

    BitacoraModule,
    MailServiceModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') as any }
      })
    }),
    TypeOrmModule.forFeature([Usuarios, UsuariosPermisos, RefreshSessions]),],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, BitacoraModule],
  exports: [JwtModule]
})
export class AuthModule { }
