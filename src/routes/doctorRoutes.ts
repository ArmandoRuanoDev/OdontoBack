import { Router } from "express";
import { doctorController } from "../controllers/doctorController";
import { authMiddleware } from "../middlewares/authMiddleware";

class DoctorRoutes {
    public router: Router = Router();

    constructor() {
        this.config();
    }

    config(): void {
        this.router.post('/configure', authMiddleware, doctorController.configurarConsultorio);
        this.router.get('/configure', authMiddleware, doctorController.obtenerConfiguracion);
    }
}

const doctorRoutes = new DoctorRoutes();
export default doctorRoutes.router;