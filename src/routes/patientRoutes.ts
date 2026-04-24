import { Router } from "express";
import { patientController } from "../controllers/patientController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requirePaidSubscription } from "../middlewares/subscriptionMiddleware";

class PatientRoutes {
    public router: Router = Router();

    constructor() {
        this.config();
    }

    config(): void {
        this.router.post('/create', authMiddleware, requirePaidSubscription, patientController.create);
        this.router.get('/getPatient', authMiddleware, requirePaidSubscription, patientController.list);
    }
}

const patientRoutes = new PatientRoutes();
export default patientRoutes.router;