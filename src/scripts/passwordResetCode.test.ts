import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('Faltan variables de entorno: SUPABASE_URL o SUPABASE_KEY');
    process.exit(1);
}

import { sendPasswordResetCode } from '../services/emailService';
import { generateSixDigitCode } from '../util/codeGenerator';

async function testEmail() {
    try {
        const email = 'ruanoarmando54@gmail.com';
        const username = 'Armando';
        const code = generateSixDigitCode();

        await sendPasswordResetCode(email, username, code);
        console.log('Correo enviado exitosamente. Revisa tu bandeja (o spam).');
    } catch (error) {
        console.error('Error al enviar:', error);
    }
}

testEmail();

// npx ts-node scripts/passwordResetCode.test.ts