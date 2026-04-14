import { sendTestEmail } from '../services/emailService';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
    try {
        await sendTestEmail(
            'ruanoarmando54@gmail.com',
            'Prueba desde Node.js',
            '<h1>¡Hola!</h1><p>Este es un correo de prueba enviado con éxito.</p>'
        );
        console.log('Correo enviado correctamente');
    } catch (error) {
        console.error('Error al enviar:', error);
    }
}

run();