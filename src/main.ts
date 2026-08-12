import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded, Response as ExpressResponse } from 'express';

/** Alineado con el mayor límite Multer (PDF OCR 25 MB). Por defecto Express usa ~100 KB → 413. */
const BODY_LIMIT = '25mb';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.use(json({ limit: BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_LIMIT }));

  app.enableCors({
    origin: '*', // Permitir todas las URLs; puedes poner un array de URLs específicas
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // elimina propiedades no definidas en el DTO
      forbidNonWhitelisted: true, // lanza error si se envían propiedades extra
      transform: true,
       transformOptions: {
        enableImplicitConversion: true, // 👈 convierte "1" -> 1
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Inmuebles Spring')
    .setDescription('Documentación automática de la API de NestJS')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        name: 'Authorization',
        description: 'Introduce tu token JWT aquí',
      },
      'access-token',
    ).addServer('http://localhost:3002/api','local').addServer('https://springtelecom.mx/inmueblesAPI/api','produccion')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  app.getHttpAdapter().get('/api/docs-json', (_req, res: ExpressResponse) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(document);
  });

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  app.setGlobalPrefix('api'); 
  const portRaw = process.env.PORT;
  const port = portRaw ? Number.parseInt(portRaw, 10) : 3002;
  await app.listen(Number.isFinite(port) ? port : 3002);
}
bootstrap();
