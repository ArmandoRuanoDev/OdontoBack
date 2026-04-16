import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('Faltan variables de entorno: SUPABASE_URL o SUPABASE_KEY');
    process.exit(1);
}

import { sendAccountBlockedAlert, sendAccountUpdateAlert, sendCancellationEmail, sendPasswordChangedConfirmation, sendPasswordResetCode, sendSecurityAlertEmail, sendSubscriptionEmail, sendSubscriptionReceipt, sendWelcomeEmail } from '../services/emailService';
import { generateSixDigitCode } from '../util/codeGenerator';

async function testEmail() {
    try {
        const email = 'ruanoarmando54@gmail.com';
        const code = generateSixDigitCode();
        const username = 'UsuarioPrueba';

        console.log(`Enviando código ${code} a ${email}...`);
        await sendAccountBlockedAlert(email, username, 15, 5, new Date(), 'null', 'null'
        );
        console.log('Correo enviado exitosamente. Revisa tu bandeja (o spam).');
    } catch (error) {
        console.error('Error al enviar:', error);
    }
}

testEmail();

// npx ts-node src/scripts/welcomeEmail.test.ts