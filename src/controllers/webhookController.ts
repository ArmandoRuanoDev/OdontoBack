import { Request, Response } from "express";
import Stripe from "stripe";
import supabase from "../database";

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

    // Verificar si el evento ya fue procesado anteriormente
    const { data: yaProcesado } = await supabase
      .schema("usuario")
      .from("tWebhookEvent")
      .select("id_evento")
      .eq("stripe_event_id", event.id)
      .maybeSingle();

    if (yaProcesado) {
      return res.json({ received: true, message: "Evento ya procesado" });
    }

    // Pago fallido
    if (event.type === 'invoice.payment_failed') {
      try {
        const invoice = event.data.object;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        const { data: usuario } = await supabase
          .schema("usuario")
          .from("tUsuario")
          .select("id_usuario")
          .eq("stripe_customer_id", customerId)
          .single();

        if (usuario) {
          await supabase
            .schema("usuario")
            .from("tUsuarioSuscripcion")
            .update({ estado: 'expirada', updated_at: new Date() })
            .eq('stripe_subscription_id', subscriptionId);

          await supabase
            .schema("usuario")
            .rpc("expirar_suscripciones_vencidas");
        }

        // Confirmar que se procesó correctamente
        await supabase
          .schema("usuario")
          .from("tWebhookEvent")
          .insert({ stripe_event_id: event.id });

        return res.json({ received: true });
      } catch (error: any) {
        console.error("Error en payment_failed:", error);
        return res.status(500).json({ error: "Error interno" });
      }
    }

    // Pago exitoso (conversión, renovación o cambio de plan)
    if (event.type === 'invoice.paid') {
      try {
        const invoice = event.data.object;
        const billingReason = invoice.billing_reason;
        const subscriptionId = invoice.subscription as string;
        const paymentIntentId = invoice.payment_intent as string;
        const customerId = invoice.customer as string;

        // Evitar procesar la misma factura dos veces (capa extra)
        const { data: pagoExistente } = await supabase
          .schema("usuario")
          .from("tPago")
          .select("id_pago")
          .eq("stripe_invoice_id", invoice.id)
          .maybeSingle();

        if (pagoExistente) {
          // Aun así, registramos el evento como procesado para no reintentarlo
          await supabase
            .schema("usuario")
            .from("tWebhookEvent")
            .insert({ stripe_event_id: event.id });
          return res.json({ received: true, message: "Ya procesado" });
        }

        const { data: usuario, error: userError } = await supabase
          .schema("usuario")
          .from("tUsuario")
          .select("id_usuario")
          .eq("stripe_customer_id", customerId)
          .single();

        if (userError || !usuario) {
          await supabase
            .schema("usuario")
            .from("tWebhookEvent")
            .insert({ stripe_event_id: event.id });
          return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const { data: metodo } = await supabase
          .schema("usuario")
          .from("tMetodoPago")
          .select("id_metodo")
          .eq("id_usuario", usuario.id_usuario)
          .eq("es_predeterminado", true)
          .single();

        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price']
        }) as any;

        const priceId = stripeSub.items.data[0]?.price.id;
        const fechaFinStripe = new Date(stripeSub.current_period_end * 1000).toISOString();

        const { data: plan } = await supabase
          .schema("usuario")
          .from("tTipoSuscripcion")
          .select("nombre")
          .eq("stripe_price_id", priceId)
          .single();
          
        if (billingReason === 'subscription_cycle') {
          await supabase
            .schema("usuario")
            .rpc("renovar_suscripcion", {
              _stripe_subscription_id: subscriptionId,
              _nuevo_monto: invoice.amount_paid / 100,
              _stripe_payment_intent_id: paymentIntentId,
              _stripe_invoice_id: invoice.id
            });
        } else {
          // subscription_create (primer cobro, fin de trial) o
          // subscription_update (cambio de plan con prorrateo)
          await supabase
            .schema("usuario")
            .rpc("convertir_a_plan_pago", {
              _id_usuario: usuario.id_usuario,
              _nombre_plan: plan!.nombre,
              _stripe_subscription_id: subscriptionId,
              _stripe_payment_intent_id: paymentIntentId,
              _stripe_invoice_id: invoice.id,
              _monto: invoice.amount_paid / 100,
              _id_metodo_pago: metodo?.id_metodo || null,
              _fecha_fin: fechaFinStripe
            });
        }

        // Confirmar evento procesado
        await supabase
          .schema("usuario")
          .from("tWebhookEvent")
          .insert({ stripe_event_id: event.id });

        return res.json({ received: true });
      } catch (error: any) {
        console.error("Error en invoice.paid:", error);
        return res.status(500).json({ error: "Error interno" });
      }
    }

    // Suscripción cancelada
    if (event.type === 'customer.subscription.deleted') {
      try {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        const { data: usuario } = await supabase
          .schema("usuario")
          .from("tUsuario")
          .select("id_usuario")
          .eq("stripe_customer_id", customerId)
          .single();

        if (usuario) {
          await supabase
            .schema("usuario")
            .from("tUsuarioSuscripcion")
            .update({ estado: 'expirada', updated_at: new Date() })
            .eq('stripe_subscription_id', subscription.id);

          await supabase
            .schema("usuario")
            .rpc("expirar_suscripciones_vencidas");
        }

        await supabase
          .schema("usuario")
          .from("tWebhookEvent")
          .insert({ stripe_event_id: event.id });

        return res.json({ received: true });
      } catch (error: any) {
        console.error("Error en subscription.deleted:", error);
        return res.status(500).json({ error: "Error interno" });
      }
    }

    // Eventos no manejados: Los registramos como procesados
    await supabase
      .schema("usuario")
      .from("tWebhookEvent")
      .insert({ stripe_event_id: event.id });

    res.json({ received: true });
  }
}

export const webHookController = new WebhookController();