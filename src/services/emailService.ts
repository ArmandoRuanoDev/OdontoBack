import nodemailer from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import dotenv from 'dotenv';
import path from 'path';

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

export async function sendTestEmail(to: string, subject: string, htmlContent: string) {
    if (!isProd && gmailTransporter) {
        await gmailTransporter.sendMail({
            from: process.env.GMAIL_USER,
            to,
            subject,
            html: htmlContent,
        });
        console.log(`Correo de prueba enviado a ${to} vía Gmail`);
    } else if (isProd && sesClient) {
        const command = new SendEmailCommand({
            Destination: { ToAddresses: [to] },
            Message: {
                Body: { Html: { Charset: 'UTF-8', Data: htmlContent } },
                Subject: { Charset: 'UTF-8', Data: subject },
            },
            Source: process.env.SES_FROM_EMAIL!,
        });
        await sesClient.send(command);
        console.log(`Correo de prueba enviado a ${to} vía SES`);
    } else {
        throw new Error('No hay cliente de email configurado');
    }
}