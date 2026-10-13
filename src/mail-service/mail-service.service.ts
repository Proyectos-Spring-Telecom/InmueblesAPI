import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export type ActividadPendienteCorreo = {
  hora: string;
  prospecto: string;
  medio: string;
  comentario: string | null;
};

const LOGO_CID = "logo-spring";
const ENLACE_EMBUDO = "https://springtelecom.mx/inmuebles";

function rutaLogo(): string {
  const compilada = join(__dirname, "logo-spring.png");
  if (existsSync(compilada)) return compilada;
  return join(process.cwd(), "src/mail-service/logo-spring.png");
}

function plantillaCorreo(titulo: string, cuerpo: string, pie: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:Arial,sans-serif;color:#171b26">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="height:6px;background:#10266b"></td></tr>
<tr><td style="padding:22px 28px 0"><img src="cid:${LOGO_CID}" width="96" height="64" alt="Spring Telecom" style="display:block;border:0"></td></tr>
<tr><td style="padding:16px 28px 8px"><h1 style="margin:0 0 14px;font-size:20px;color:#10266b">${escaparHtml(titulo)}</h1>
${cuerpo}${pie}</td></tr>
</table></td></tr></table></body></html>`;
}

function htmlActividadesDelDia(
  nombre: string,
  fecha: string,
  actividades: ActividadPendienteCorreo[],
): string {
  const parrafos = [
    `Buenos días, ${nombre}. Esto es lo que tienes pendiente:`,
    ...actividades.map((actividad) => {
      const comentario = actividad.comentario?.trim() || "Sin comentario";
      return `• ${actividad.prospecto} — ${fecha}, ${actividad.hora} (${actividad.medio}) — ${comentario}`;
    }),
  ];
  const cuerpo = parrafos
    .map(
      (parrafo) =>
        `<p style="margin:0 0 12px;font-size:14px;line-height:1.5">${escaparHtml(parrafo)}</p>`,
    )
    .join("");
  const pie = `<p style="margin:6px 0 24px"><a href="${ENLACE_EMBUDO}" style="display:inline-block;background:#10266b;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-size:14px">Abrir el CRM</a></p>`;
  return plantillaCorreo(
    `Tus pendientes de hoy (${actividades.length})`,
    cuerpo,
    pie,
  );
}

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

@Injectable()
export class MailServiceService {
    private transporter: nodemailer.Transporter;

    constructor() {
      const port = parseInt(process.env.SMTP || '465', 10);
      this.transporter = nodemailer.createTransport({
        host: process.env.HOST, // o tu proveedor SMTP
        port: port,
        secure: port === 465, // true para 465, false para otros puertos
        auth: {
          user: process.env.E_MAIL,
          pass: process.env.E_MAIL_PASS,
        },
      });
    }
  
    async sendConfirmationEmail(to: string, name: string, token: string) {
      try {
        const url = `http://localhost:3000/login/verify?token=${token}`;
        await this.transporter.sendMail({
          from: `<${process.env.E_MAIL}>`,
          to,
          subject: '¡Bienvenido!',
          html: `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Document</title>
  </head>
  <body style="font-family: 'Open Sans', sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
              <td align="center">
                  <table width="550px" style="background-color: #FFFFFF; border-radius: 13px; box-shadow: rgba(100, 100, 111, 0.2) 0px 7px 29px 0px;" cellpadding="0" cellspacing="0">
                      <!-- Header -->
                      <tr>
                          <td  style="background-color: #002136; color: #FFFFFF; padding: 1rem; ">
                              <a href="#">
                                  <img src="https://transmovi.s3.us-east-2.amazonaws.com/logos/transmovi.png" alt="logo" style="height: 95px;">
                              </a>
                          </td>
                      </tr>
                      <!-- Body -->
                      <tr>
                          <td  style="padding: 0 2rem; "  align="center">
                              <h5 style="color: #002136; font-size: 30px; text-align:center">
                                  ¡Bienvenido!
                              </h5>
                              <p style="color: #002136; font-family: 'Open Sans', sans-serif; font-size: 16px; text-align: center; margin-top: -30px;">${name} nos alegra que estés aquí, te damos la bienvenida a Transmovi. <strong>Por favor, confirma tu correo electrónico haciendo click en el siguiente botón.</strong></p>
                              <a href=${url} style="font-size: 18px; padding: 0.9rem; background-color: #43cc7a; color: #FFFFFF; border-radius: 30px; text-decoration: none; display: inline-block; margin-top: 13px; ">Confirmar correo electrónico</a>
                          </td>
                      </tr>
                      <!-- Divider -->
                      <tr><td  style="padding: 0 2rem; "><hr style="border: none; height: 2px; background-color: rgba(226, 226, 226, 0.589); margin-top: 25px;"></td></tr>
                      <tr>
                          <td  style="padding: 0 2rem; "><br>
                              <p style="margin: 0; font-size: 16px; font-family: 'Open Sans', sans-serif;"><strong>Nota: </strong>Este correo fue enviado desde una dirección de notificaciones, por favor no respondas a este mensaje, es solo de ENVÍO. Si tampoco reconoces está acción puedes ignorar este correo electrónico.</p>
                              <p >Atentamente,</p>
                              <p style="margin-top: -10px;"><strong>Transmovi</strong></p>
                          <br>
                          </td>
                      </tr>
                      <!-- Footer -->
                      <tr>
                          <td style="background-color: #002136; color: #FFFFFF; padding: 2rem; " align="center">
                              <!-- Contenido del footer aquí -->                  
                              <h5 style="color: #FFFFFF; margin: 0; font-family: 'Open Sans', sans-serif; font-size: 13px;"><b>Gracias
                                  por registrarte con nosotros.</b></h5><br>
                              <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">Si necesita ayuda o tiene
                                  preguntas, siempre nos complace poder ayudarle. Comuníquese con nosotros enviándonos un correo
                                  electrónico a contacto@transmovi.mx</p>
                              <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">Atentamente,</p>
                              <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">© Transmovi</p>
                              <br>
                              <p style="margin: 0; font-size: 9px; font-family: 'Open Sans', sans-serif;">Transmovi, Av. Independencia Manzana #016, Col. Centro, 50000 Toluca de Lerdo, México. 
                                  RFC:QSY240515579</p>
                              <!-- Redes sociales y más -->
                          </td>
                      </tr>
                  </table>
              </td>
          </tr>
      </table>
  </body>
  </html>
        `,
        });
      } catch (error) {
        console.error('Error al enviar correo de confirmación:', error.message);
        // No lanzamos el error para que no falle la creación del usuario
        // El correo puede fallar pero el usuario debe crearse igualmente
      }
    }
  
    async sendActividadesDelDia(
      to: string,
      nombre: string,
      fecha: string,
      actividades: ActividadPendienteCorreo[],
    ) {
      const titulo = `Tus pendientes de hoy (${actividades.length})`;
      await this.transporter.sendMail({
        from: `<${process.env.E_MAIL}>`,
        to,
        subject: `${titulo} · ${fecha}`,
        html: htmlActividadesDelDia(nombre, fecha, actividades),
        attachments: [
          {
            filename: "spring-telecom.png",
            content: readFileSync(rutaLogo()),
            contentType: "image/png",
            cid: LOGO_CID,
          },
        ],
      });
    }

    async sendResetPasswordEmail(to: string,name: string, token: string) {
      try {
        const url = `https://springtelecom.mx/inmuebles/cambio-password?token=${token}`;
        // 👆 Este debe apuntar a tu frontend Angular (puedes ajustarlo a localhost:3000 si haces la prueba desde backend)
    
        await this.transporter.sendMail({
        from: ` <${process.env.E_MAIL}>`,
        to,
        subject: 'Restablecer Contraseña',
        html: `
  <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Restablecer Contraseña</title>
</head>
<body style="font-family: 'Open Sans', sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td align="center">
                <table width="550px" style="background-color: #FFFFFF; border-radius: 13px; box-shadow: rgba(100, 100, 111, 0.2) 0px 7px 29px 0px;" cellpadding="0" cellspacing="0">
                    <!-- Header -->
                    <tr>
                        <td  style="background-color: #021d6a; color: #FFFFFF; padding: 1rem; ">
                            <a href="#">
                                <img src="https://analiticadevideo.s3.us-east-1.amazonaws.com/Imagenes/spring_white.png" alt="logo" style="height: 95px;">
                            </a>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td  style="padding: 0 2rem; "  align="center">
                            <h5 style="color: #691330; font-size: 30px; text-align:center">
                                Restablecer Contraseña
                            </h5>
                            <p style="color: #000; font-family: 'Open Sans', sans-serif; font-size: 16px; text-align: center; margin-top: -30px;">Hola, haz click en el siguiente botón para restablecer tu contraseña. Si no has solicitado una nueva contraseña, <strong>ignora este correo</strong>.</p>
                            <a href="${url}" style="font-size: 18px; padding: 0.9rem; background-color: #691330; color: #FFFFFF; border-radius: 30px; text-decoration: none; display: inline-block; margin-top: 13px; ">Restablecer Contraseña</a>
                        </td>
                    </tr>
                    <!-- Divider -->
                    <tr><td  style="padding: 0 2rem; "><hr style="border: none; height: 2px; background-color: rgba(226, 226, 226, 0.589); margin-top: 25px;"></td></tr>
                    <tr>
                        <td  style="padding: 0 2rem; "><br>
                            <p style="margin: 0; font-size: 16px; font-family: 'Open Sans', sans-serif;"><strong>Nota: </strong>Recibes este correo electrónico porque has solicitado restablecer tu contraseña. Si no estas seguro/a de por qué estás recibiendo esto ignoralo.</p>
                            <p >Atentamente,</p>
                            <p style="margin-top: -10px;"><strong>Spring Telecom</strong></p>
                        <br>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #021d6a; color: #FFFFFF; padding: 2rem; " align="center">
                            <!-- Contenido del footer aquí -->                  
                            <h5 style="color: #FFFFFF; margin: 0; font-family: 'Open Sans', sans-serif; font-size: 13px;"><b>Tu entorno unificado para la gestión y análisis.</b></h5><br>
                            <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">Si necesita ayuda o tiene
                                preguntas, siempre nos complace poder ayudarle. Comuníquese con nosotros enviándonos un correo
                                electrónico a contacto@springtelecom.mx</p>
                            <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">Atentamente,</p>
                            <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">© Spring Telecom</p>
                            <br>
                            <p style="margin: 0; font-size: 9px; font-family: 'Open Sans', sans-serif;">Spring Telecom, C. San Cristóbal 103 piso 2, San Cristóbal, 62250 Cuernavaca, Morelos.</p>
                            <!-- Redes sociales y más -->
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
      `,
        });
      } catch (error) {
        console.error('Error al enviar correo de restablecimiento de contraseña:', error.message);
        // No lanzamos el error para que no falle el proceso
        throw error; // En este caso sí lanzamos porque es crítico para reset password
      }
    }
}
