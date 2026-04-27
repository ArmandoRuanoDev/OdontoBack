import { Request, Response } from "express";
import Stripe from "stripe";
import supabase from "../database";
import { logError } from "../util/logError";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

class WebhookController {
  
  public async handleStripeWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'] as string;
    let event: any;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription as string;
      const paymentIntentId = invoice.payment_intent as string;
      const customerId = invoice.customer as string;

      // Verificar si ya procesamos este invoice
      const { data: pagoExistente } = await supabase
        .schema("usuario")
        .from("tPago")
        .select("id_pago")
        .eq("stripe_invoice_id", invoice.id)
        .maybeSingle();

      if (pagoExistente) {
        return res.json({ received: true, message: "Ya procesado" });
      }

      // Obtener el usuario por customer_id
      const { data: usuario, error: userError } = await supabase
        .schema("usuario")
        .from("tUsuario")
        .select("id_usuario")
        .eq("stripe_customer_id", customerId)
        .single();

      if (userError || !usuario) return res.status(404).json({ error: "Usuario no encontrado" });

      // Obtener el método de pago local
      const { data: metodo } = await supabase
        .schema("usuario")
        .from("tMetodoPago")
        .select("id_metodo")
        .eq("id_usuario", usuario.id_usuario)
        .eq("es_predeterminado", true)
        .single();

      // Obtener el nombre del plan desde el price_id en la suscripción
      const stripeSub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['items.data.price'] });
      const priceId = stripeSub.items.data[0]?.price.id;

      const { data: plan } = await supabase
        .schema("usuario")
        .from("tTipoSuscripcion")
        .select("nombre")
        .eq("stripe_price_id", priceId)
        .single();

      // Llamar a convertir_a_plan_pago
      await supabase
        .schema("usuario")
        .rpc("convertir_a_plan_pago", {
          _id_usuario: usuario.id_usuario,
          _nombre_plan: plan!.nombre,
          _stripe_subscription_id: subscriptionId,
          _stripe_payment_intent_id: paymentIntentId,
          _stripe_invoice_id: invoice.id,
          _monto: invoice.amount_paid / 100,
          _id_metodo_pago: metodo?.id_metodo || null
      });
    }

    res.json({ received: true });
  }
}

export const webHookController = new WebhookController();