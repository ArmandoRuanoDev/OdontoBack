import { Router } from "express";
import { subscriptionController } from "../controllers/subscriptionController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requirePaidSubscription } from "../middlewares/susbcriptionMiddleware";

class SubscribeRoutes {
    public router: Router = Router();

    constructor() {
        this.config();
    }

    config() : void {
        this.router.get('/current', authMiddleware, subscriptionController.getCurrentSubscription);
        // Rutas que requieren suscripción paga
        this.router.post('/subscribe', authMiddleware, subscriptionController.subscribe);
        this.router.post('/cancel-subscription', authMiddleware, requirePaidSubscription, subscriptionController.cancelSubscription);
    }
}

const subscribeRoutes = new SubscribeRoutes();
export default subscribeRoutes.router;