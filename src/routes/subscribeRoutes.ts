import { Router } from "express";
import { subscriptionController } from "../controllers/subscriptionController";
import { authMiddleware } from "../middlewares/authMiddleware";

class SubscribeRoutes {
    public router: Router = Router();

    constructor() {
        this.config();
    }

    config() : void {
        this.router.post('/subscribe', authMiddleware, subscriptionController.subscribe);
        this.router.post('/cancel-subscription', authMiddleware, subscriptionController.cancelSubscription);
    }
}

const subscribeRoutes = new SubscribeRoutes();
export default subscribeRoutes.router;