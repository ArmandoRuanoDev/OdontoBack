import express, { Application } from "express";
import AuthRoutes from "./routes/authRoutes"; 
import SubscribeRoutes from "./routes/subscribeRoutes";
import PatientRoutes from "./routes/patientRoutes";
import { webHookController } from "./controllers/webhookController";
import morgan from "morgan";
import cors from "cors";


class Server {
    public app: Application;

    constructor() {
        this.app = express();
        this.config();
        this.routes();
    }    

    config() : void {
        const corsOptions = {
            origin: 'http://localhost:4200', // Frontend
            credentials: true,
            optionsSuccessStatus: 200
        };

        this.app.set('port', process.env.PORT || 3000);
        this.app.use(morgan('dev'));
        this.app.use(cors(corsOptions));
        this.app.post(
            "/api/sub/webhooks/stripe",
            express.raw({ type: "application/json" }),
            webHookController.handleStripeWebhook
        );
        this.app.use(express.json());
        this.app.use(express.urlencoded({extended : false}));
    }

    routes() : void {
        this.app.use("/api/auth", AuthRoutes);
        this.app.use("/api/sub", SubscribeRoutes);
        this.app.use("/api/pat", PatientRoutes);
    }

    start(): void {
        this.app.listen(this.app.get('port'), () => {
            console.log('Server running on port', this.app.get('port'));
        });
    }
}

const server = new Server();
server.start();
