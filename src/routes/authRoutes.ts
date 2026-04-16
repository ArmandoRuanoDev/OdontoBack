import { Router } from "express";
import { authController } from "../controllers/authController";
import rateLimit from 'express-rate-limit';
import { authMiddleware } from "../middlewares/authMiddleware";

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
    }
}

const authRoutes = new AuthRoutes();
export default authRoutes.router;