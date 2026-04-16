import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('Faltan variables de entorno: SUPABASE_URL o SUPABASE_KEY');
    process.exit(1);
}

import { sendWelcomeEmail } from '../services/emailService';

async function testEmail() {
    try {
        const email = 'ruanoarmando54@gmail.com';
        const username = 'Armando';

        await sendWelcomeEmail(email, username);
        console.log('Correo enviado exitosamente. Revisa tu bandeja (o spam).');
    } catch (error) {
        console.error('Error al enviar:', error);
    }
}

testEmail();

// npx ts-node scripts/welcomeEmail.test.ts