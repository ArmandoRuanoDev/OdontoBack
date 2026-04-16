import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('Faltan variables de entorno: SUPABASE_URL o SUPABASE_KEY');
    process.exit(1);
}

import { sendAccountUpdateAlert } from '../services/emailService';

async function testEmail() {
    try {
        const email = 'ruanoarmando54@gmail.com';
        const username = 'Armando';

        await sendAccountUpdateAlert(email, username, {email: {old: "armandold@gmail.com", new: "armandonew@gmail.com" }}, new Date())
        console.log('Correo enviado exitosamente. Revisa tu bandeja (o spam).');
    } catch (error) {
        console.error('Error al enviar:', error);
    }
}

testEmail();

// npx ts-node scripts/accountUpdateAlert.test.ts