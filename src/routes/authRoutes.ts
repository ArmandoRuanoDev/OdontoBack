import { Router } from "express";
import { authController } from "../controllers/authController";
import rateLimit from 'express-rate-limit';

const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 35, // máximo 5 intentos por IP
    message: "Demasiadas solicitudes de registro, intente más tarde"
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30, // más intentos que registro
    message: "Demasiados intentos de inicio de sesión, intente más tarde"
});

const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5,
    message: "Demasiadas solicitudes de restablecimiento, intente más tarde"
});

class AuthRoutes {
    public router: Router = Router();

    constructor() {
        this.config();
    }

    config() : void {
        this.router.post('/register', registerLimiter, authController.register);
        this.router.post('/login', loginLimiter, authController.login);
        this.router.post('/send-verification-code', authController.sendVerificationCode);
        this.router.post('/verify-email', authController.verifyEmail);
        this.router.post('/send-password-reset-code', passwordResetLimiter, authController.sendChangePasswordCode);
        this.router.post('/verify-password-code', authController.verifyPasswordCode);
        this.router.post('/reset-password', passwordResetLimiter, authController.resetPassword);
        this.router.post('/refresh-token', authController.refreshToken);
    }
}

const authRoutes = new AuthRoutes();
export default authRoutes.router;