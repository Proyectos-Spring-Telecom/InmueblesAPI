import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosModule } from './usuarios/usuarios.module';
import { ClientesModule } from './clientes/clientes.module';
import { RolesModule } from './roles/roles.module';
import { ModulosModule } from './modulos/modulos.module';
import { PermisosModule } from './permisos/permisos.module';
import { MarcasModule } from './marcas/marcas.module';
import { BitacoraModule } from './bitacora/bitacora.module';
import { AuthModule } from './auth/auth.module';
import { ModelosModule } from './modelos/modelos.module';
import { EquiposModule } from './equipos/equipos.module';
import { MailServiceService } from './mail-service/mail-service.service';
import { CatProductosModule } from './cat-productos/cat-productos.module';
import { IncidenciasModule } from './incidencias/incidencias.module';
import { InstalacionCentralModule } from './instalacion-central/instalacion-central.module';
import { InstalacionEquipoModule } from './instalacion-equipo/instalacion-equipo.module';
import { S3Module } from './s3/s3.module';
import { CatDepartamentosModule } from './cat-departamentos/cat-departamentos.module';
import { ReportesModule } from './reportes/reportes.module';
import { PdfOcrModule } from './pdf-ocr/pdf-ocr.module';
import { MailServiceModule } from './mail-service/mail-service.module'
import { CatServiciosModule } from './cat-servicios/cat-servicios.module';
import { AiToolsModule } from './ai-tools/ai-tools.module';
import { ChatModule } from './chat/chat.module';
import { InmueblesModule } from './inmuebles/inmuebles.module';
import { ArrendatariosModule } from './arrendatarios/arrendatarios.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { InpcModule } from './inpc/inpc.module';
import { FactoresModule } from './factores/factores.module';
import { FormulasModule } from './formulas/formulas.module';
import { CatMetodosPagoModule } from './cat-metodos-pago/cat-metodos-pago.module';
import { PagoModule } from './pago/pago.module';
import Joi from 'joi';
import { join } from 'path';

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true,
    // Carga .env junto al proyecto (src/ o dist/), no solo desde process.cwd()
    envFilePath: join(__dirname, '..', '.env'),
    validationSchema: Joi.object({
      DB_HOST: Joi.string().required(),
      DB_PORT: Joi.number().default(3306),
      DB_USER: Joi.string().required(),
      DB_PASSWORD: Joi.string().allow(''),
      DB_DATABASE: Joi.string().required(),
      JWT_SECRET: Joi.string().required(),
      JWT_EXPIRES_IN: Joi.string().required(),
      JWT_REFRESH_EXPIRES_IN: Joi.string().required(),
      DB_TZ: Joi.string().default('-06:00'),
      AI_SERVICE_KEY: Joi.string().required(),
      SPRINGAGENT_URL: Joi.string().default('http://localhost:8001'),
      SPRINGAGENT_TIMEOUT: Joi.number().default(120000),
    }),
  }),

  TypeOrmModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      type: 'mysql',
      host: config.get<string>('DB_HOST'),
      port: config.get<number>('DB_PORT'),
      username: config.get<string>('DB_USER'),
      password: config.get<string>('DB_PASSWORD'),
      database: config.get<string>('DB_DATABASE'),
      autoLoadEntities: false,
      entities: [__dirname + '/entities/*{.ts,.js}'],
      synchronize: false, //Nunca poner en true 
      bigNumberStrings: false,
      dateStrings: false,

      timezone: 'America/Mexico_City',
    }),
  }),

    UsuariosModule,

    ClientesModule,

    RolesModule,

    ModulosModule,

    PermisosModule,

    MarcasModule,

    ModelosModule,

    AuthModule,

    MailServiceModule,

    BitacoraModule,
    EquiposModule,
    CatProductosModule,
    IncidenciasModule,
    InstalacionCentralModule,
    InstalacionEquipoModule,
    S3Module,
    CatDepartamentosModule,
    CatServiciosModule,
    InmueblesModule,
    ArrendatariosModule,
    NotificacionesModule,
    InpcModule,
    FactoresModule,
    FormulasModule,
    CatMetodosPagoModule,
    PagoModule,
    ReportesModule,
    PdfOcrModule,
    AiToolsModule,
    ChatModule,
  ],
    
  controllers: [AppController],
  providers: [MailServiceService],
})
export class AppModule { }
