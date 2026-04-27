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
        this.router.post('/', authMiddleware, requirePaidSubscription, patientController.create);
        this.router.get('/', authMiddleware, requirePaidSubscription, patientController.list);
        //this.router.get('/:id', authMiddleware, requirePaidSubscription, patientController.getById);
        //this.router.put('/:id', authMiddleware, requirePaidSubscription, patientController.update);
        //this.router.patch('/:id/deactivate', authMiddleware, requirePaidSubscription, patientController.deactivate);
    }
}

const patientRoutes = new PatientRoutes();
export default patientRoutes.router;