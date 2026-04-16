import nodemailer from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import dotenv from 'dotenv';
import path from 'path';
import supabase from '../database';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isProd = process.env.NODE_ENV === 'production';

// Configuración de desarrollo
let gmailTransporter: nodemailer.Transporter | null = null;
if (!isProd) {
    gmailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });
}

// Configuración de producción (SES)
let sesClient: SESClient | null = null;
if (isProd) {
    sesClient = new SESClient({
        region: process.env.AWS_REGION!,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
    });
}

async function sendEmail(to: string, subject: string, html: string) {
    try {
        if (!isProd && gmailTransporter) {
            await gmailTransporter.sendMail({
                from: process.env.GMAIL_USER,
                to,
                subject,
                html,
            });
            console.log(`Correo enviado a ${to} vía Gmail`);
        } else if (isProd && sesClient) {
            const command = new SendEmailCommand({
                Destination: { ToAddresses: [to] },
                Message: {
                    Body: { Html: { Charset: 'UTF-8', Data: html } },
                    Subject: { Charset: 'UTF-8', Data: subject },
                },
                Source: process.env.SES_FROM_EMAIL!,
            });
            await sesClient.send(command);
            console.log(`Correo enviado a ${to} vía SES`);
        } else { 
            throw new Error('No hay cliente de email configurado');
        }
    } catch (error: any) {
        console.error('Error al enviar correo:', error);
        try {
            await supabase.schema('sistema').from('lSistema').insert({
                id_usuario: null,
                mensaje_error: error.message || 'Error desconocido al enviar correo',
                detalle_error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
                clase: 'EmailService',
                metodo: 'sendEmail',
                ip_address: null,
                user_agent: null
            });
        } catch (logErr) {
            console.error('No se pudo guardar el error en lSistema:', logErr);
        }
        throw error;
    }
}


export async function sendWelcomeEmail(to: string, username: string) {
  const subject = '¡Bienvenido a Todonto! Tu consulta dental, ahora en digital 🦷';

  const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenido(a) a Todonto</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f0f4f8; }

    @media only screen and (max-width: 600px) {
      .email-wrapper  { width: 100% !important; }
      .email-header   { padding: 28px 20px !important; }
      .email-body     { padding: 24px 20px !important; }
      .email-footer   { padding: 20px !important; }
      .feature-inner  { padding: 14px !important; }
      .cta-btn        { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">

<!-- Preheader oculto -->
<div style="display:none;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Tu cuenta está lista. Comienza a transformar la gestión de tu consulta desde hoy.
</div>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f4f8;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table class="email-wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

        <!-- ===== HEADER ===== -->
        <tr>
          <td class="email-header" align="center"
            style="background-color:#185FA5;padding:36px 40px 30px;border-radius:14px 14px 0 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" width="54" height="54"
                        style="background-color:#0C447C;border-radius:14px;text-align:center;vertical-align:middle;font-size:26px;line-height:54px;width:54px;height:54px;">
                        🦷
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:#ffffff;font-size:24px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">
                    Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.6);font-size:11px;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Tu clínica dental digital
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== BODY ===== -->
        <tr>
          <td class="email-body"
            style="background-color:#ffffff;padding:36px 40px;border-left:1px solid #B5D4F4;border-right:1px solid #B5D4F4;">

            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Saludo -->
              <tr>
                <td style="padding-bottom:8px;">
                  <span style="font-size:22px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">
                    ¡Hola, ${username}! 👋
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0;font-size:15px;color:#555555;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">
                    Nos alegra mucho que estés aquí. Tu cuenta en <strong style="color:#185FA5;">Todonto</strong> ya está lista. A partir de hoy, gestionar tu consulta dental será mucho más sencillo, ordenado y humano.
                  </p>
                </td>
              </tr>

              <!-- Divisor bicolor -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="35%" height="3" style="background-color:#185FA5;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="65%" height="3" style="background-color:#B5D4F4;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Etiqueta sección -->
              <tr>
                <td style="padding-bottom:14px;">
                  <span style="font-size:11px;font-weight:bold;color:#185FA5;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Con Todonto puedes
                  </span>
                </td>
              </tr>

              <!-- Feature: Agenda -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    📅
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;">
                                Agenda inteligente
                              </p>
                              <p style="margin:0;font-size:13px;color:#185FA5;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
                                Programa citas fácilmente con recordatorios automáticos para tus pacientes.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Feature: Expedientes -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    📋
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;">
                                Expedientes clínicos
                              </p>
                              <p style="margin:0;font-size:13px;color:#185FA5;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
                                Historial completo por paciente: diagnósticos, tratamientos y radiografías.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Feature: Pacientes -->
              <tr>
                <td style="padding-bottom:30px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    👥
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;">
                                Registro de pacientes
                              </p>
                              <p style="margin:0;font-size:13px;color:#185FA5;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
                                Alta, búsqueda y seguimiento desde un solo lugar, sin papeleo.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CTA -->
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                    href="${process.env.FRONTEND_URL}" style="height:50px;v-text-anchor:middle;width:220px;" arcsize="20%"
                    fillcolor="#185FA5" strokecolor="#185FA5">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">
                      Acceder a mi cuenta &rarr;
                    </center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="background-color:#185FA5;border-radius:10px;">
                        <a class="cta-btn" href="${process.env.FRONTEND_URL}" target="_blank"
                          style="display:inline-block;background-color:#185FA5;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;padding:15px 40px;border-radius:10px;text-align:center;">
                          Acceder a mi cuenta &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                  <!--<![endif]-->
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:28px;">
                  <span style="font-size:12px;color:#aaaaaa;font-family:Arial,Helvetica,sans-serif;">
                    El acceso es válido por 48 horas.
                  </span>
                </td>
              </tr>

              <!-- Divisor -->
              <tr>
                <td style="border-top:1px solid #B5D4F4;padding-top:20px;padding-bottom:0;font-size:0;line-height:0;">&nbsp;</td>
              </tr>

              <!-- Soporte -->
              <tr>
                <td style="padding-top:4px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="36" style="vertical-align:top;padding-right:12px;padding-top:2px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" width="30" height="30"
                              style="background-color:#E6F1FB;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;line-height:30px;width:30px;height:30px;">
                              ℹ️
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="margin:0;font-size:13px;color:#777777;font-family:Arial,Helvetica,sans-serif;line-height:1.65;">
                          ¿Tienes alguna pregunta? Escríbenos a
                          <a href="mailto:soporte@todonto.com" style="color:#185FA5;text-decoration:none;font-weight:bold;">
                            soporte@todonto.com
                          </a>
                          — te respondemos en menos de 24 horas con gusto.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td class="email-footer" align="center"
            style="background-color:#042C53;padding:24px 40px;border-radius:0 0 14px 14px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <span style="color:rgba(255,255,255,0.55);font-size:13px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                    🦷 Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:rgba(255,255,255,0.35);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    &copy; 2026 Todonto &middot; Todos los derechos reservados
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.22);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    Si no creaste esta cuenta, puedes ignorar este correo con seguridad.
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>
  `;

  await sendEmail(to, subject, html);
}

/**
 * Envía un correo de confirmación de suscripción
 * @param to - Correo del usuario
 * @param username - Nombre del usuario
 * @param plan - Nombre del plan (ej. "Mensual", "Anual", "Prueba")
 * @param price - Precio pagado (puede ser 0 para periodo de prueba)
 * @param currency - Moneda (ej. "MXN")
 * @param startDate - Fecha de inicio
 * @param endDate - Fecha de fin (o null si es perpetua)
 * @param isTrial - Indica si es un periodo de prueba gratuito
 */
export async function sendSubscriptionEmail(
    to: string,
    username: string,
    plan: string,
    price: number,
    currency: string,
    startDate: Date,
    endDate: Date | null,
    isTrial: boolean = false
) {
    const subject = isTrial
        ? '🎉 ¡Tu periodo de prueba en Todonto ha comenzado!'
        : '¡Gracias por tu suscripción a Todonto! 🎉';

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const startFormatted = formatDate(startDate);
    const endFormatted = endDate ? formatDate(endDate) : 'Nunca (suscripción de por vida)';

    const priceFormatted = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(price);

    // Determinar ciclo de facturación según el nombre del plan
    let billingCycle = '';
    if (plan.toLowerCase().includes('mensual')) billingCycle = 'mes';
    else if (plan.toLowerCase().includes('anual')) billingCycle = 'año';
    else if (plan.toLowerCase().includes('prueba')) billingCycle = 'mes';
    else billingCycle = 'período contratado';

    // Texto adicional para periodo de prueba
    let trialWarning = '';
    if (isTrial) {
        trialWarning = `
            <div style="background-color:#FFF3E0; padding:14px 18px; border-radius:8px; margin:20px 0;">
                <p style="margin:0; font-size:13px; color:#E65100;">
                    <strong>⚠️ Importante:</strong> Tu periodo de prueba finaliza el <strong>${endFormatted}</strong>. Al término, se realizará automáticamente el cobro del plan mensual ($399.00MXN) a menos que cancele antes.
                </p>
            </div>
        `;
    }

    const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${isTrial ? 'Comienza tu prueba' : 'Confirmación de suscripción'} - Todonto</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f0f4f8; }

    @media only screen and (max-width: 600px) {
      .email-wrapper  { width: 100% !important; }
      .email-header   { padding: 28px 20px !important; }
      .email-body     { padding: 24px 20px !important; }
      .email-footer   { padding: 20px !important; }
      .feature-inner  { padding: 14px !important; }
      .cta-btn        { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">

<div style="display:none;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${isTrial ? 'Activa tu prueba gratuita por 7 días.' : 'Confirma los detalles de tu plan y la facturación automática.'}
</div>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f4f8;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table class="email-wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

        <!-- ===== HEADER ===== -->
        <tr>
          <td class="email-header" align="center"
            style="background-color:#185FA5;padding:36px 40px 30px;border-radius:14px 14px 0 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" width="54" height="54"
                        style="background-color:#0C447C;border-radius:14px;text-align:center;vertical-align:middle;font-size:26px;line-height:54px;width:54px;height:54px;">
                        🦷
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:#ffffff;font-size:24px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">
                    Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.6);font-size:11px;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    ${isTrial ? 'Prueba gratuita' : 'Suscripción activa'}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== BODY ===== -->
        <tr>
          <td class="email-body"
            style="background-color:#ffffff;padding:36px 40px;border-left:1px solid #B5D4F4;border-right:1px solid #B5D4F4;">

            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Saludo -->
              <tr>
                <td style="padding-bottom:8px;">
                  <span style="font-size:22px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">
                    ¡Hola, ${username}! 👋
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0;font-size:15px;color:#555555;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">
                    ${isTrial
                        ? 'Tu periodo de prueba gratuito ha comenzado. Disfruta de todas las ventajas de Todonto durante 7 días.'
                        : '¡Felicidades! Tu suscripción a <strong style="color:#185FA5;">Todonto</strong> ha sido activada exitosamente.'}
                  </p>
                </td>
              </tr>

              <!-- Divisor bicolor -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="35%" height="3" style="background-color:#185FA5;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="65%" height="3" style="background-color:#B5D4F4;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Etiqueta sección -->
              <tr>
                <td style="padding-bottom:14px;">
                  <span style="font-size:11px;font-weight:bold;color:#185FA5;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Detalles de tu plan
                  </span>
                </td>
              </tr>

              <!-- Detalles del plan (estilo feature) -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    📋
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">Plan contratado</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;">${plan}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Monto y fechas -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    💰
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">Monto</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;">${priceFormatted} (${currency})</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    📅
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">Fecha de inicio</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;">${startFormatted}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-bottom:20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    ⏳
                                  </td>
                                <tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">Fecha de expiración</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;">${endFormatted}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Advertencia de prueba -->
              ${trialWarning}

              <!-- Información legal y facturación -->
              <tr>
                <td style="padding-bottom:20px;">
                  <div style="background-color:#F9F9F9; padding:14px 18px; border-radius:8px; border:1px solid #E0E0E0;">
                    <p style="margin:0 0 8px; font-size:13px; color:#555;">
                      <strong>🔁 Facturación automática:</strong> Tu suscripción se renovará automáticamente cada <strong>${billingCycle}</strong> utilizando el método de pago que proporcionaste. Recibirás un recibo por cada cargo.
                    </p>
                    <p style="margin:0; font-size:13px; color:#555;">
                      <strong>Cancelación:</strong> Puedes cancelar en cualquier momento desde tu perfil. Al cancelar, no se realizarán cargos futuros y seguirás teniendo acceso hasta la fecha de expiración.
                      <br/>
                      <a href="${process.env.FRONTEND_URL}/perfil/cancelar-suscripcion" style="color:#185FA5; text-decoration:underline;">Cancelar suscripción →</a>
                    </p>
                  </div>
                </td>
              </tr>

              <!-- CTA Botón principal -->
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="background-color:#185FA5;border-radius:10px;">
                        <a href="${process.env.FRONTEND_URL}/dashboard" target="_blank"
                          style="display:inline-block;background-color:#185FA5;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;padding:15px 40px;border-radius:10px;text-align:center;">
                          Ir a mi cuenta &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Divisor -->
              <tr>
                <td style="border-top:1px solid #B5D4F4;padding-top:20px;padding-bottom:0;font-size:0;line-height:0;">&nbsp;</td>
              </tr>

              <!-- Soporte y términos -->
              <tr>
                <td style="padding-top:4px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="36" style="vertical-align:top;padding-right:12px;padding-top:2px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" width="30" height="30"
                              style="background-color:#E6F1FB;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;line-height:30px;width:30px;height:30px;">
                              ℹ️
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="margin:0;font-size:13px;color:#777777;font-family:Arial,Helvetica,sans-serif;line-height:1.65;">
                          ¿Tienes alguna pregunta? Escríbenos a
                          <a href="mailto:soporte@todonto.com" style="color:#185FA5;text-decoration:none;font-weight:bold;">
                            soporte@todonto.com
                          </a>
                          — te respondemos en menos de 24 horas.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-top:12px;">
                  <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">
                    Al suscribirte, aceptas nuestros 
                    <a href="${process.env.FRONTEND_URL}/terminos" style="color:#185FA5;text-decoration:underline;">Términos y Condiciones</a> 
                    y 
                    <a href="${process.env.FRONTEND_URL}/privacidad" style="color:#185FA5;text-decoration:underline;">Aviso de Privacidad</a>.
                    Los cargos se procesarán automáticamente según el ciclo seleccionado. Puedes cancelar en cualquier momento desde tu perfil.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td class="email-footer" align="center"
            style="background-color:#042C53;padding:24px 40px;border-radius:0 0 14px 14px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <span style="color:rgba(255,255,255,0.55);font-size:13px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                    🦷 Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:rgba(255,255,255,0.35);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    &copy; 2026 Todonto · Todos los derechos reservados
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.22);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    ${isTrial ? 'Al finalizar la prueba se cobrará el plan mensual automáticamente.' : 'Recibirás un recibo por cada cargo.'}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

    await sendEmail(to, subject, html);
}

/**
 * Envía un correo de confirmación de cancelación de suscripción
 * @param to - Correo del usuario
 * @param username - Nombre del usuario
 * @param plan - Nombre del plan cancelado
 * @param endDate - Fecha en que expirará el acceso (si aplica)
 */
export async function sendCancellationEmail(
    to: string,
    username: string,
    plan: string,
    endDate: Date | null
) {
    const subject = 'Lamentamos que te vayas – Todonto';
    
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    
    const endFormatted = endDate ? formatDate(endDate) : 'de inmediato';
    
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f44336; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0;">Todonto</h1>
            </div>
            <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2>¡Hola, ${username}!</h2>
                <p>Lamentamos que hayas decidido cancelar tu suscripción al plan <strong>${plan}</strong>.</p>
                <p>Tu acceso continuará activo hasta <strong>${endFormatted}</strong>.</p>
                
                <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;">¿Fue algo que pudimos mejorar? <a href="${process.env.FRONTEND_URL}/feedback">Cuéntanos tu opinión</a> para seguir creciendo.</p>
                </div>
                
                <p>Recuerda que <strong>siempre serás bienvenido de regreso</strong>. Puedes volver a suscribirte en cualquier momento y recuperar todos los beneficios de Todonto.</p>
                
                <a href="${process.env.FRONTEND_URL}/suscripciones" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px;">Volver a suscribirme</a>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
                <p style="color: #777; font-size: 12px;">Si no solicitaste esta cancelación, por favor contacta a soporte inmediatamente.</p>
            </div>
        </div>
    `;
    
    await sendEmail(to, subject, html);
}

/**
 * Envía un correo de recordatorio de que la prueba está por expirar (1 día restante)
 * @param to - Correo del usuario
 * @param username - Nombre del usuario
 * @param planName - Nombre del plan de prueba (ej. "Prueba gratuita")
 * @param expirationDate - Fecha de expiración
 * @param subscribeLink - Enlace para suscribirse al plan completo
 * @param cancelLink - Enlace para cancelar la prueba (opcional, pero recomendado)
 */
export async function sendTrialReminderEmail(
    to: string,
    username: string,
    planName: string,
    expirationDate: Date,
    subscribeLink: string,
    cancelLink?: string
) {
    const subject = '⏰ Tu prueba gratuita en Todonto termina mañana';
    
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    
    const expirationFormatted = formatDate(expirationDate);
    
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #FF9800; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0;">Todonto</h1>
            </div>
            <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2>¡Hola, ${username}!</h2>
                <p>Tu periodo de prueba del plan <strong>${planName}</strong> termina <strong>mañana (${expirationFormatted})</strong>.</p>
                <p>Para no perder el acceso a las funciones avanzadas de Todonto, te invitamos a suscribirte a uno de nuestros planes.</p>
                
                <div style="background-color: #FFF3E0; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>🎁 Beneficios al suscribirte:</strong></p>
                    <ul>
                        <li>Acceso ilimitado a todas las herramientas</li>
                        <li>Soporte prioritario</li>
                        <li>Recordatorios personalizados</li>
                    </ul>
                </div>
                
                <a href="${subscribeLink}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 10px 10px 0;">Suscribirme ahora</a>
                ${cancelLink ? `<a href="${cancelLink}" style="display: inline-block; background-color: #f44336; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0;">Cancelar prueba</a>` : ''}
                
                <p style="margin-top: 20px;">Si decides no continuar, tu cuenta volverá al plan gratuito básico, pero siempre puedes volver a activar tus beneficios en cualquier momento.</p>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
                <p style="color: #777; font-size: 12px;">Si ya realizaste tu suscripción, ignora este mensaje.</p>
            </div>
        </div>
    `;
    
    await sendEmail(to, subject, html);
}

/**
 * Envía un código de verificación de 6 dígitos (para verificación de correo.)
 * @param to - Correo electrónico del destinatario
 * @param code - Código de 6 dígitos
 * @param username - Nombre del usuario (opcional)
 */
export async function sendCodeVerificationEmail(to: string, code: string, username?: string) {
    const subject = '🔐 Código de verificación - Todonto';

    const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verifica tu correo - Todonto</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f0f4f8; }

    @media only screen and (max-width: 600px) {
      .email-wrapper  { width: 100% !important; }
      .email-header   { padding: 28px 20px !important; }
      .email-body     { padding: 24px 20px !important; }
      .email-footer   { padding: 20px !important; }
      .feature-inner  { padding: 14px !important; }
      .cta-btn        { display: block !important; text-align: center !important; }
      .code-block     { font-size: 28px !important; letter-spacing: 4px !important; padding: 12px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">

<!-- Preheader oculto -->
<div style="display:none;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Usa este código para verificar tu dirección de correo.
</div>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f4f8;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table class="email-wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

        <!-- ===== HEADER ===== -->
        <tr>
          <td class="email-header" align="center"
            style="background-color:#185FA5;padding:36px 40px 30px;border-radius:14px 14px 0 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" width="54" height="54"
                        style="background-color:#0C447C;border-radius:14px;text-align:center;vertical-align:middle;font-size:26px;line-height:54px;width:54px;height:54px;">
                        ✉️
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:#ffffff;font-size:24px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">
                    Verifica tu correo
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.6);font-size:11px;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Todonto · Seguridad de tu cuenta
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== BODY ===== -->
        <tr>
          <td class="email-body"
            style="background-color:#ffffff;padding:36px 40px;border-left:1px solid #B5D4F4;border-right:1px solid #B5D4F4;">

            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Saludo -->
              <tr>
                <td style="padding-bottom:8px;">
                  <span style="font-size:22px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">
                    ${username ? `¡Hola, ${username}! 👋` : '¡Hola! 👋'}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0;font-size:15px;color:#555555;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">
                    Para confirmar tu dirección de correo electrónico y activar tu cuenta en <strong style="color:#185FA5;">Todonto</strong>, utiliza el siguiente código de verificación.
                  </p>
                </td>
              </tr>

              <!-- Divisor bicolor -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="35%" height="3" style="background-color:#185FA5;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="65%" height="3" style="background-color:#B5D4F4;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Etiqueta sección -->
              <tr>
                <td style="padding-bottom:14px;">
                  <span style="font-size:11px;font-weight:bold;color:#185FA5;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Tu código de seguridad
                  </span>
                </td>
              </tr>

              <!-- Bloque del código -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:14px;border-left:4px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:20px 24px;text-align:center;">
                        <span class="code-block" style="font-size:38px;font-weight:bold;letter-spacing:6px;color:#0C447C;font-family:monospace;display:inline-block;background-color:#ffffff;padding:16px 24px;border-radius:12px;border:1px solid #B5D4F4;">
                          ${code}
                        </span>
                        <p style="margin:16px 0 0 0;font-size:13px;color:#185FA5;font-family:Arial,Helvetica,sans-serif;">
                          Este código expira en <strong>10 minutos</strong>.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Instrucciones -->
              <tr>
                <td style="padding-bottom:30px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#F4F9FF;border-radius:10px;">
                    <tr>
                      <td class="feature-inner" style="padding:18px 20px;">
                        <p style="margin:0 0 8px 0;font-size:14px;font-weight:bold;color:#0C447C;">
                          🔍 ¿Cómo usar este código?
                        </p>
                        <p style="margin:0;font-size:13px;color:#555555;line-height:1.55;">
                          1. Ingresa el código en la pantalla de verificación de Todonto.<br/>
                          2. Una vez verificado, tu cuenta quedará completamente activa.<br/>
                          3. Si no solicitaste este cambio, ignora este correo.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Divisor -->
              <tr>
                <td style="border-top:1px solid #B5D4F4;padding-top:20px;padding-bottom:0;font-size:0;line-height:0;">&nbsp;</td>
              </tr>

              <!-- Soporte -->
              <tr>
                <td style="padding-top:4px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="36" style="vertical-align:top;padding-right:12px;padding-top:2px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" width="30" height="30"
                              style="background-color:#E6F1FB;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;line-height:30px;width:30px;height:30px;">
                              ℹ️
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="margin:0;font-size:13px;color:#777777;font-family:Arial,Helvetica,sans-serif;line-height:1.65;">
                          ¿No recibiste el código? Revisa tu bandeja de spam o contacta a
                          <a href="mailto:soporte@todonto.com" style="color:#185FA5;text-decoration:none;font-weight:bold;">
                            soporte@todonto.com
                          </a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td class="email-footer" align="center"
            style="background-color:#042C53;padding:24px 40px;border-radius:0 0 14px 14px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <span style="color:rgba(255,255,255,0.55);font-size:13px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                    🦷 Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:rgba(255,255,255,0.35);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    &copy; 2026 Todonto · Todos los derechos reservados
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.22);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    Este es un mensaje automático, por favor no responder.
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;

    await sendEmail(to, subject, html);
}
/**
 * Envía un correo con un código de 6 dígitos para restablecer la contraseña
 * @param to - Correo del destinatario
 * @param username - Nombre del usuario
 * @param code - Código de 6 dígitos
 */
export async function sendPasswordResetCode(to: string, username: string, code: string) {
    const subject = 'Código para restablecer tu contraseña - Todonto';
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #2196F3; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0;">Todonto</h1>
            </div>
            <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2>¡Hola, ${username}!</h2>
                <p>Recibimos una solicitud para restablecer tu contraseña. Utiliza el siguiente código de verificación:</p>
                <div style="background-color: #e3f2fd; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 5px; font-weight: bold; border-radius: 8px; margin: 20px 0;">
                    ${code}
                </div>
                <p>Este código expira en 10 minutos.</p>
                <p>Si no solicitaste el cambio de contraseña, puedes ignorar este correo.</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
                <p style="color: #777; font-size: 12px;">Equipo de Todonto</p>
            </div>
        </div>
    `;
    await sendEmail(to, subject, html);
}

/**
 * Envía una alerta de seguridad por un nuevo inicio de sesión
 * @param to - Correo del usuario
 * @param username - Nombre del usuario
 * @param ip - Dirección IP del inicio de sesión
 * @param userAgent - Agente de usuario (dispositivo/navegador)
 * @param loginTime - Fecha y hora del inicio de sesión
 */
export async function sendSecurityAlertEmail(
    to: string,
    username: string,
    ip: string,
    userAgent: string,
    loginTime: Date,
) {
    const subject = '🔐 Alerta de seguridad: Nuevo inicio de sesión en Todonto';

    const formatDateTime = (date: Date) => {
        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const timeFormatted = formatDateTime(loginTime);
    const device = userAgent.includes('Mobile') ? 'Móvil' : 'Ordenador';
    const browser = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)/)?.[0] || 'Desconocido';

    const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Alerta de seguridad - Todonto</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f0f4f8; }

    @media only screen and (max-width: 600px) {
      .email-wrapper  { width: 100% !important; }
      .email-header   { padding: 28px 20px !important; }
      .email-body     { padding: 24px 20px !important; }
      .email-footer   { padding: 20px !important; }
      .feature-inner  { padding: 14px !important; }
      .cta-btn        { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">

<!-- Preheader oculto -->
<div style="display:none;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Nuevo acceso detectado. Verifica si eres tú.
</div>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f4f8;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table class="email-wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

        <!-- ===== HEADER (color alerta) ===== -->
        <tr>
          <td class="email-header" align="center"
            style="background-color:#D32F2F;padding:36px 40px 30px;border-radius:14px 14px 0 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" width="54" height="54"
                        style="background-color:#B71C1C;border-radius:14px;text-align:center;vertical-align:middle;font-size:26px;line-height:54px;width:54px;height:54px;">
                        ⚠️
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:#ffffff;font-size:24px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">
                    Alerta de seguridad
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.7);font-size:11px;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Todonto · Protege tu cuenta
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== BODY ===== -->
        <tr>
          <td class="email-body"
            style="background-color:#ffffff;padding:36px 40px;border-left:1px solid #F5C6C6;border-right:1px solid #F5C6C6;">

            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Saludo -->
              <tr>
                <td style="padding-bottom:8px;">
                  <span style="font-size:22px;font-weight:bold;color:#B71C1C;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">
                    ¡Hola, ${username}! 👋
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0;font-size:15px;color:#555555;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">
                    Hemos detectado un <strong style="color:#D32F2F;">nuevo inicio de sesión</strong> en tu cuenta de <strong style="color:#185FA5;">Todonto</strong>. Si fuiste tú, puedes ignorar este mensaje. Si no, te recomendamos tomar acción de inmediato.
                  </p>
                </td>
              </tr>

              <!-- Divisor bicolor -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="35%" height="3" style="background-color:#D32F2F;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="65%" height="3" style="background-color:#F5C6C6;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Etiqueta sección -->
              <tr>
                <td style="padding-bottom:14px;">
                  <span style="font-size:11px;font-weight:bold;color:#D32F2F;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Detalles del acceso
                  </span>
                </td>
              </tr>

              <!-- Feature: Fecha y hora -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#FFF5F5;border-radius:10px;border-left:3px solid #D32F2F;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#D32F2F;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    📅
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#B71C1C;font-family:Arial,Helvetica,sans-serif;">
                                Fecha y hora
                              </p>
                              <p style="margin:0;font-size:13px;color:#555;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
                                ${timeFormatted}
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Feature: IP -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#FFF5F5;border-radius:10px;border-left:3px solid #D32F2F;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#D32F2F;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    🌐
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#B71C1C;font-family:Arial,Helvetica,sans-serif;">
                                Dirección IP
                              </p>
                              <p style="margin:0;font-size:13px;color:#555;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
                                ${ip}
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Feature: Dispositivo -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#FFF5F5;border-radius:10px;border-left:3px solid #D32F2F;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#D32F2F;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    💻
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#B71C1C;font-family:Arial,Helvetica,sans-serif;">
                                Dispositivo y navegador
                              </p>
                              <p style="margin:0;font-size:13px;color:#555;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
                                ${device} · ${browser}
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Sección de recomendaciones -->
              <tr>
                <td style="padding-bottom:30px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#FFF5F5;border-radius:10px;border-left:3px solid #D32F2F;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#D32F2F;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    🛡️
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#B71C1C;font-family:Arial,Helvetica,sans-serif;">
                                ¿No reconoces esta actividad?
                              </p>
                              <p style="margin:0;font-size:13px;color:#555;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
                                Alguien más podría estar accediendo a tu cuenta. Te recomendamos:
                              </p>
                              <ul style="margin:8px 0 0 20px;padding:0;font-size:13px;color:#555;">
                                <li>Cambiar tu contraseña inmediatamente</li>
                                <li>Revisar los dispositivos conectados en tu perfil</li>
                                <li>Contactar a soporte si ves actividad sospechosa</li>
                              </ul>
                             </td>
                           </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CTA Botones -->
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="display:inline-block;">
                    <tr>
                      <td style="width:12px;"></td>
                      <td align="center" style="background-color:#185FA5;border-radius:10px;">
                        <a href="${process.env.FRONTEND_URL}/perfil/seguridad" target="_blank"
                          style="display:inline-block;background-color:#185FA5;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;padding:15px 30px;border-radius:10px;text-align:center;">
                          Ir a seguridad
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:28px;">
                  <span style="font-size:12px;color:#aaaaaa;font-family:Arial,Helvetica,sans-serif;">
                    Si fuiste tú, ignora este mensaje. De lo contrario, actúa de inmediato.
                  </span>
                </td>
              </tr>

              <!-- Divisor -->
              <tr>
                <td style="border-top:1px solid #F5C6C6;padding-top:20px;padding-bottom:0;font-size:0;line-height:0;">&nbsp;</td>
              </tr>

              <!-- Soporte -->
              <tr>
                <td style="padding-top:4px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="36" style="vertical-align:top;padding-right:12px;padding-top:2px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" width="30" height="30"
                              style="background-color:#FFF5F5;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;line-height:30px;width:30px;height:30px;">
                              ℹ️
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="margin:0;font-size:13px;color:#777777;font-family:Arial,Helvetica,sans-serif;line-height:1.65;">
                          ¿Tienes alguna pregunta? Escríbenos a
                          <a href="mailto:soporte@todonto.com" style="color:#185FA5;text-decoration:none;font-weight:bold;">
                            soporte@todonto.com
                          </a>
                          — te respondemos en menos de 24 horas con gusto.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td class="email-footer" align="center"
            style="background-color:#042C53;padding:24px 40px;border-radius:0 0 14px 14px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <span style="color:rgba(255,255,255,0.55);font-size:13px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                    🦷 Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:rgba(255,255,255,0.35);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    &copy; 2026 Todonto · Todos los derechos reservados
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.22);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    Este es un aviso de seguridad automático.
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;

    await sendEmail(to, subject, html);
}

/**
 * Envía una alerta cuando se actualiza información sensible de la cuenta (correo o teléfono)
 * @param to - Correo del usuario (puede ser el nuevo o el antiguo, según contexto)
 * @param username - Nombre del usuario
 * @param changes - Objeto con los cambios realizados { email?: { old, new }, phone?: { old, new } }
 * @param changeDate - Fecha del cambio
 * @param reportLink - Enlace para reportar actividad sospechosa (opcional)
 */
export async function sendAccountUpdateAlert(
    to: string,
    username: string,
    changes: {
        email?: { old: string; new: string };
        phone?: { old: string; new: string };
    },
    changeDate: Date,
    reportLink?: string
) {
    const subject = '⚠️ Alerta: Tu información de cuenta ha sido actualizada - Todonto';
    
    const formatDateTime = (date: Date) => {
        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };
    
    const timeFormatted = formatDateTime(changeDate);
    
    // Construir lista de cambios
    let changesList = '';
    if (changes.email) {
        changesList += `
            <p><strong>📧 Correo electrónico:</strong><br/>
            Antiguo: ${changes.email.old}<br/>
            Nuevo: ${changes.email.new}</p>
        `;
    }
    if (changes.phone) {
        changesList += `
            <p><strong>📱 Número de teléfono:</strong><br/>
            Antiguo: ${changes.phone.old}<br/>
            Nuevo: ${changes.phone.new}</p>
        `;
    }
    
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #FF9800; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0;">Todonto</h1>
            </div>
            <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2>¡Hola, ${username}!</h2>
                <p>Se han realizado cambios en la información de tu cuenta de <strong>Todonto</strong> el día <strong>${timeFormatted}</strong>.</p>
                
                <div style="background-color: #FFF3E0; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0;"><strong>📝 Detalles de los cambios:</strong></p>
                    ${changesList}
                </div>
                
                <p><strong>¿No reconoces estos cambios?</strong> Alguien más podría estar accediendo a tu cuenta.</p>
                <p>Te recomendamos:</p>
                <ul>
                    <li>Cambiar tu contraseña inmediatamente</li>
                    <li>Revisar los dispositivos conectados en tu perfil</li>
                    <li>Contactar a soporte</li>
                </ul>
                
                ${reportLink ? `<a href="${reportLink}" style="display: inline-block; background-color: #f44336; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px;">Reportar actividad sospechosa</a>` : ''}
                <a href="${process.env.FRONTEND_URL}/perfil/seguridad" style="display: inline-block; background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px; margin-left: 10px;">Ir a seguridad</a>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
                <p style="color: #777; font-size: 12px;">Si fuiste tú quien realizó estos cambios, ignora este mensaje. De lo contrario, actúa de inmediato.</p>
            </div>
        </div>
    `;
    
    await sendEmail(to, subject, html);
}

/**
 * Envía un correo de confirmación de cambio de contraseña exitoso
 * @param to - Correo del usuario
 * @param username - Nombre del usuario
 * @param changeDate - Fecha y hora del cambio
 * @param reportLink - Enlace para reportar actividad sospechosa (opcional)
 */
export async function sendPasswordChangedConfirmation(
    to: string,
    username: string,
    changeDate: Date,
    reportLink?: string
) {
    const subject = '🔒 Tu contraseña ha sido cambiada - Todonto';
    
    const formatDateTime = (date: Date) => {
        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };
    
    const timeFormatted = formatDateTime(changeDate);
    
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #4CAF50; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0;">Todonto</h1>
            </div>
            <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2>¡Hola, ${username}!</h2>
                <p>Tu contraseña de <strong>Todonto</strong> ha sido cambiada exitosamente el día <strong>${timeFormatted}</strong>.</p>
                
                <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;">Si realizaste este cambio, no necesitas hacer nada más. Tu cuenta sigue segura.</p>
                </div>
                
                <p><strong>¿No realizaste este cambio?</strong> Alguien más podría estar accediendo a tu cuenta.</p>
                <p>Te recomendamos:</p>
                <ul>
                    <li>Cambiar tu contraseña nuevamente</li>
                    <li>Revisar los dispositivos conectados en tu perfil</li>
                    <li>Contactar a soporte inmediatamente</li>
                </ul>
                
                ${reportLink ? `<a href="${reportLink}" style="display: inline-block; background-color: #f44336; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px;">Reportar actividad sospechosa</a>` : ''}
                <a href="${process.env.FRONTEND_URL}/perfil/seguridad" style="display: inline-block; background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px; margin-left: 10px;">Ir a seguridad</a>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
                <p style="color: #777; font-size: 12px;">Si fuiste tú, ignora este mensaje. De lo contrario, actúa de inmediato.</p>
            </div>
        </div>
    `;
    
    await sendEmail(to, subject, html);
}

/**
 * Envía un recibo de suscripción (factura) al usuario
 * @param to - Correo del usuario
 * @param username - Nombre del usuario
 * @param receiptNumber - Número de recibo/factura (puedes generarlo como "TOD-YYYYMMDD-XXXX")
 * @param plan - Nombre del plan (ej. "Mensual", "Anual")
 * @param price - Precio pagado
 * @param currency - Moneda (ej. "MXN")
 * @param startDate - Fecha de inicio
 * @param endDate - Fecha de fin (o null si perpetua)
 * @param paymentMethod - Método de pago (ej. "Tarjeta terminada en 1234", "PayPal", etc.)
 * @param transactionId - ID de transacción de la pasarela de pagos (opcional)
 * @param tax - Impuestos aplicados (opcional, ej. 0.16)
 */
export async function sendSubscriptionReceipt(
    to: string,
    username: string,
    receiptNumber: string,
    plan: string,
    price: number,
    currency: string,
    startDate: Date,
    endDate: Date | null,
    paymentMethod: string,
    transactionId?: string,
    tax?: number
) {
    const subject = `🧾 Tu recibo de suscripción - Todonto (${receiptNumber})`;
    
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    
    const formatDateTime = (date: Date) => {
        return date.toLocaleString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    const startFormatted = formatDate(startDate);
    const endFormatted = endDate ? formatDate(endDate) : 'Suscripción de por vida';
    const receiptDateFormatted = formatDateTime(new Date());
    
    const priceFormatted = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(price);
    
    let subtotal = price;
    let taxAmount = 0;
    let total = price;
    
    if (tax && tax > 0) {
        taxAmount = price * tax;
        total = price + taxAmount;
    }
    
    const taxFormatted = taxAmount ? new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(taxAmount) : null;
    const totalFormatted = new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(total);
    
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #4CAF50; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0;">Todonto</h1>
                <p style="color: white; margin: 5px 0 0;">Recibo de suscripción</p>
            </div>
            <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <p style="text-align: right; color: #777; margin: 0;">${receiptNumber}</p>
                <p style="text-align: right; color: #777; margin-top: 0;">${receiptDateFormatted}</p>
                
                <h2>¡Hola, ${username}!</h2>
                <p>Gracias por tu compra. A continuación, los detalles de tu suscripción a <strong>Todonto</strong>.</p>
                
                <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0;"><strong>Plan contratado:</strong> ${plan}</p>
                    <p style="margin: 0 0 10px 0;"><strong>Fecha de inicio:</strong> ${startFormatted}</p>
                    <p style="margin: 0 0 10px 0;"><strong>Fecha de expiración:</strong> ${endFormatted}</p>
                    <p style="margin: 0 0 10px 0;"><strong>Método de pago:</strong> ${paymentMethod}</p>
                    ${transactionId ? `<p style="margin: 0;"><strong>ID de transacción:</strong> ${transactionId}</p>` : ''}
                </div>
                
                <div style="border-top: 2px solid #ddd; border-bottom: 2px solid #ddd; padding: 10px 0; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Resumen de cargos:</strong></p>
                    <p style="margin: 5px 0; display: flex; justify-content: space-between;">
                        <span>Subtotal:</span>
                        <span>${priceFormatted}</span>
                    </p>
                    ${taxFormatted ? `<p style="margin: 5px 0; display: flex; justify-content: space-between;">
                        <span>IVA (${(tax! * 100).toFixed(0)}%):</span>
                        <span>${taxFormatted}</span>
                    </p>` : ''}
                    <p style="margin: 10px 0 5px; font-weight: bold; font-size: 1.2em; display: flex; justify-content: space-between;">
                        <span>Total:</span>
                        <span>${totalFormatted}</span>
                    </p>
                </div>
                
                <p>Este recibo es válido como comprobante de pago. Puedes descargarlo desde tu perfil en cualquier momento.</p>
                
                <a href="${process.env.FRONTEND_URL}/perfil/suscripciones" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px;">Ver mis suscripciones</a>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
                <p style="color: #777; font-size: 12px;">Si tienes alguna duda, contacta a soporte@todonto.com</p>
            </div>
        </div>
    `;
    
    await sendEmail(to, subject, html);
}

/**
 * Envía una alerta cuando la cuenta ha sido bloqueada por muchos intentos fallidos
 * @param to - Correo del usuario
 * @param username - Nombre del usuario
 * @param blockDurationMinutes - Duración del bloqueo en minutos (ej. 15)
 * @param attempts - Número de intentos fallidos que causaron el bloqueo
 * @param blockExpiresAt - Fecha y hora en que terminará el bloqueo
 * @param resetPasswordLink - Enlace para restablecer contraseña (opcional)
 * @param supportLink - Enlace a soporte (opcional)
 */
export async function sendAccountBlockedAlert(
    to: string,
    username: string,
    blockDurationMinutes: number,
    attempts: number,
    blockExpiresAt: Date,
    resetPasswordLink?: string,
    supportLink?: string
) {
    const subject = '🔒 Tu cuenta ha sido bloqueada temporalmente - Todonto';
    
    const formatDateTime = (date: Date) => {
        return date.toLocaleString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };
    
    const expiresFormatted = formatDateTime(blockExpiresAt);
    
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f44336; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0;">Todonto</h1>
            </div>
            <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2>¡Hola, ${username}!</h2>
                <p>Hemos detectado <strong>${attempts} intentos fallidos consecutivos</strong> para iniciar sesión en tu cuenta de <strong>Todonto</strong>.</p>
                <p>Por seguridad, tu cuenta ha sido <strong>bloqueada temporalmente por ${blockDurationMinutes} minutos</strong>.</p>
                
                <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0;"><strong>⏰ Fin del bloqueo:</strong> ${expiresFormatted}</p>
                    <p style="margin: 0;"><strong>🔐 Motivo:</strong> Demasiados intentos fallidos (posible ataque de fuerza bruta o contraseña olvidada).</p>
                </div>
                
                <p><strong>¿Qué puedes hacer?</strong></p>
                <ul>
                    <li>Esperar a que termine el bloqueo para volver a intentarlo.</li>
                    <li>Restablecer tu contraseña si no la recuerdas.</li>
                    <li>Si no fuiste tú, contacta a soporte para asegurar tu cuenta.</li>
                </ul>
                
                ${resetPasswordLink ? `<a href="${resetPasswordLink}" style="display: inline-block; background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 10px 10px 0;">Restablecer contraseña</a>` : ''}
                ${supportLink ? `<a href="${supportLink}" style="display: inline-block; background-color: #f44336; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0;">Contactar soporte</a>` : ''}
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
                <p style="color: #777; font-size: 12px;">Si fuiste tú quien olvidó la contraseña, ignora este mensaje y espera el fin del bloqueo. De lo contrario, actúa de inmediato.</p>
            </div>
        </div>
    `;
    
    await sendEmail(to, subject, html);
}