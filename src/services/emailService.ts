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

// Al final del archivo emailService.ts, después de sendAuthCode

/**
 * Envía un correo de bienvenida a un usuario recién registrado
 * @param to - Correo electrónico del destinatario
 * @param username - Nombre del usuario
 */
export async function sendWelcomeEmail(to: string, username: string) {
    const subject = '¡Bienvenido a Todonto! 🦷';
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #4CAF50; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0;">Todonto</h1>
            </div>
            <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2>¡Hola, ${username}!</h2>
                <p>Estamos muy contentos de darte la bienvenida a <strong>Todonto</strong>, tu asistente dental inteligente.</p>
                <p>Con Todonto podrás:</p>
                <ul>
                    <li>📅 Agendar citas fácilmente</li>
                    <li>🔔 Recibir recordatorios de tus tratamientos</li>
                    <li>📊 Llevar el control de tu historial dental</li>
                    <li>👨‍⚕️ Conectar con especialistas de confianza</li>
                </ul>
                <p>Para comenzar, explora nuestra plataforma y descubre todas las herramientas que tenemos para ti.</p>
                <a href="${process.env.FRONTEND_URL}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px;">Ir a Todonto</a>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
                <p style="color: #777; font-size: 12px;">Si no te registraste en Todonto, por favor ignora este correo.</p>
            </div>
        </div>
    `;
    await sendEmail(to, subject, html);
}

/**
 * Envía un correo de confirmación de suscripción
 * @param to - Correo del usuario
 * @param username - Nombre del usuario
 * @param plan - Nombre del plan (ej. "Mensual", "Anual")
 * @param price - Precio pagado
 * @param currency - Moneda (ej. "MXN")
 * @param startDate - Fecha de inicio (Timestamp)
 * @param endDate - Fecha de fin (Timestamp o null si es perpetua)
 * @param status - Estado de la suscripción (activa, pendiente, etc.)
 */
export async function sendSubscriptionEmail(
    to: string,
    username: string,
    plan: string,
    price: number,
    currency: string,
    startDate: Date,
    endDate: Date | null,
    status: string
) {
    const subject = '¡Gracias por tu suscripción a Todonto! 🎉';
    
    // Formatear fechas a formato local (México)
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
    
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #4CAF50; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0;">Todonto</h1>
            </div>
            <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2>¡Hola, ${username}!</h2>
                <p>¡Felicidades! Tu suscripción a <strong>Todonto</strong> ha sido activada exitosamente.</p>
                
                <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0;">Detalles de tu plan</h3>
                    <p><strong>Plan:</strong> ${plan}</p>
                    <p><strong>Monto pagado:</strong> ${priceFormatted}</p>
                    <p><strong>Fecha de inicio:</strong> ${startFormatted}</p>
                    <p><strong>Fecha de expiración:</strong> ${endFormatted}</p>
                    <p><strong>Estado:</strong> ${status === 'activa' ? 'Activa ✅' : status}</p>
                </div>
                
                <p>Ahora tienes acceso a todos los beneficios exclusivos de <strong>${plan}</strong>. Disfruta de:</p>
                <ul>
                    <li>✔️ Acceso ilimitado a todas las funcionalidades</li>
                    <li>✔️ Soporte prioritario</li>
                    <li>✔️ Recordatorios personalizados</li>
                </ul>
                
                <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px;">Ir a mi cuenta</a>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
                <p style="color: #777; font-size: 12px;">Si no realizaste esta compra, por favor contacta a soporte inmediatamente.</p>
            </div>
        </div>
    `;
    
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
 * Envía un código de autenticación de 6 dígitos (para verificación de correo, 2FA, etc.)
 * @param to - Correo electrónico del destinatario
 * @param code - Código de 6 dígitos
 * @param username - Nombre del usuario
 */
export async function sendAuthCode(to: string, code: string, username?: string) {
    const subject = 'Código de autenticación';
    const html = `
        <div style="font-family: Arial, sans-serif;">
            <h2>${username ? `Hola, ${username}` : 'Hola'}!</h2>
            <p>Tu código de autenticación es:</p>
            <h1 style="font-size: 32px; letter-spacing: 5px;">${code}</h1>
            <p>Este código expira en 10 minutos.</p>
            <p>Si no solicitaste este código, ignora este mensaje.</p>
        </div>
    `;
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
 * @param reportLink - Enlace para reportar actividad sospechosa (opcional)
 */
export async function sendSecurityAlertEmail(
    to: string,
    username: string,
    ip: string,
    userAgent: string,
    loginTime: Date,
    reportLink?: string
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
    
    // Extraer información básica del userAgent (opcional)
    const device = userAgent.includes('Mobile') ? 'Móvil' : 'Ordenador';
    const browser = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)/)?.[0] || 'Desconocido';
    
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f44336; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0;">Todonto</h1>
            </div>
            <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2>¡Hola, ${username}!</h2>
                <p>Hemos detectado un nuevo inicio de sesión en tu cuenta de <strong>Todonto</strong>.</p>
                
                <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0;"><strong>📅 Fecha y hora:</strong> ${timeFormatted}</p>
                    <p style="margin: 0 0 10px 0;"><strong>🌐 Dirección IP:</strong> ${ip}</p>
                    <p style="margin: 0 0 10px 0;"><strong>💻 Dispositivo:</strong> ${device}</p>
                    <p style="margin: 0;"><strong>🔍 Navegador:</strong> ${browser}</p>
                </div>
                
                <p><strong>¿No reconoces esta actividad?</strong> Alguien más podría estar accediendo a tu cuenta.</p>
                <p>Te recomendamos:</p>
                <ul>
                    <li>Cambiar tu contraseña inmediatamente</li>
                    <li>Revisar los dispositivos conectados en tu perfil</li>
                    <li>Contactar a soporte si ves actividad sospechosa</li>
                </ul>
                
                ${reportLink ? `<a href="${reportLink}" style="display: inline-block; background-color: #f44336; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px;">Reportar como no reconocido</a>` : ''}
                <a href="${process.env.FRONTEND_URL}/perfil/seguridad" style="display: inline-block; background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px; margin-left: 10px;">Ir a seguridad</a>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
                <p style="color: #777; font-size: 12px;">Si fuiste tú, ignora este mensaje. De lo contrario, actúa de inmediato.</p>
            </div>
        </div>
    `;
    
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