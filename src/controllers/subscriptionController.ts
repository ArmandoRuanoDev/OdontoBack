import { Request, Response } from "express";
import Stripe from "stripe";
import supabase from "../database";
import { logError } from "../util/logError";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-04-22.dahlia"
});

class SubscriptionController {

  /**
    * GET /api/sub/plans
    * Obtiene todos los planes disponibles para Todonto.
   */
  public async getPlans(req: Request, res: Response) {
    try {
      const { data, error } = await supabase
        .schema("usuario")
        .from("tTipoSuscripcion")
        .select("*")
        .eq("activo", true)
        .order("precio");

      if (error) {
        await logError(req, error, 'SubscriptionController', 'getPlans', 'usuario', 'lStripe');
        return res.status(500).json({ message: "Error al obtener los planes" });
      }

      res.json(data);
    } catch (err) {
      await logError(req, err, 'SubscriptionController', 'getPlans', 'usuario', 'lStripe');
      res.status(500).json({ message: "Error interno del servidor" });
    }
  }

  /**
    * POST /api/sub/trial
    * Asigna el plan de prueba a usuario.
   */
  async startTrial(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { payment_method_id } = req.body;

      if (!payment_method_id)
        return res.status(400).json({ message: "payment_method_id requerido" });

      // Usamos el price_id del plan Profesional (mensual)
      const targetPriceId = process.env.DEFAULT_TRIAL_PRICE_ID;

      // Obtener o crear customer
      const { data: usuarioDB, error: userDBError } = await supabase
        .schema("usuario")
        .from("tUsuario")
        .select("stripe_customer_id")
        .eq("id_usuario", user.id_usuario)
        .single();

      if (userDBError) throw userDBError;

      let customerId = usuarioDB.stripe_customer_id;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.correo_electronico,
          name: user.nombre_usuario,
        });
        customerId = customer.id;

        // Guardar en la base de datos
        await supabase
          .schema("usuario")
          .from("tUsuario")
          .update({ stripe_customer_id: customerId })
          .eq("id_usuario", user.id_usuario);
      }

      // Adjuntar y hacer predeterminado el método de pago
      await stripe.paymentMethods.attach(payment_method_id, { customer: customerId });
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: payment_method_id },
      });

      const pm = await stripe.paymentMethods.retrieve(payment_method_id);

      // Crear suscripción con trial de 14 días en Stripe
      const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60; // 14 días en segundos UNIX

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: targetPriceId! }],
        default_payment_method: payment_method_id,
        trial_end: trialEnd,
        expand: ['latest_invoice.payment_intent'],
        metadata: { id_usuario: user.id_usuario },
      });

      // Llamar a la función SQL que guarda la prueba con referencia a la suscripción
      const { error } = await supabase
        .schema("usuario")
        .rpc("activar_prueba_con_suscripcion", {
          _id_usuario: user.id_usuario,
          _stripe_customer_id: customerId,
          _stripe_payment_method_id: payment_method_id,
          _tipo_metodo: "card",
          _marca: pm.card?.brand,
          _ultimos_digitos: pm.card?.last4,
          _expira_mes: pm.card?.exp_month,
          _expira_anio: pm.card?.exp_year,
          _stripe_subscription_id: subscription.id,
          _fecha_fin_trial: new Date(trialEnd * 1000).toISOString()
        });

      if (error) throw error;

      return res.json({
        message: "Prueba activada. Se convertirá automáticamente en plan de pago al finalizar los 14 días.",
        subscription_id: subscription.id,
        trial_end: trialEnd
      });
    } catch (error: any) {
      await logError(req, error, "Subscription", "startTrial", "usuario", "lStripe");
      return res.status(500).json({ message: error.message || "Error al activar la prueba" });
    }
  }

  /**
    * POST /api/sub/subscribe
    * Asigna un plan de pago a usuario.
   */
  async subscribe(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { price_id, payment_method_id } = req.body;

      if (!price_id) {
        return res.status(400).json({ message: "price_id es requerido" });
      }


      // Obtener o crear el customer de Stripe
      const { data: usuarioDB, error: userDBError } = await supabase
        .schema("usuario")
        .from("tUsuario")
        .select("stripe_customer_id")
        .eq("id_usuario", user.id_usuario)
        .single();

      if (userDBError) throw userDBError;

      let customerId = usuarioDB.stripe_customer_id;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.correo_electronico,
          name: user.nombre_usuario,
        });
        customerId = customer.id;

        await supabase
          .schema("usuario")
          .from("tUsuario")
          .update({ stripe_customer_id: customerId })
          .eq("id_usuario", user.id_usuario);
      }

      // Si se envió un nuevo método de pago, adjuntarlo y hacerlo predeterminado.
      // Si no, sincronizar el que tengamos en base de datos con Stripe.
      let metodoPagoLocalId: number | null = null;
      let metodoPagoStripeId: string | undefined = undefined;

      if (payment_method_id) {
        // Adjuntar al customer
        await stripe.paymentMethods.attach(payment_method_id, { customer: customerId });

        // Hacerlo predeterminado
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: payment_method_id,
          },
        });

        // Obtener datos del método de pago
        const pm = await stripe.paymentMethods.retrieve(payment_method_id);

        // Insertar o actualizar en tMetodoPago
        const { data: metodoInsertado, error: metodoError } = await supabase
          .schema("usuario")
          .from("tMetodoPago")
          .upsert({
            id_usuario: user.id_usuario,
            stripe_payment_method_id: payment_method_id,
            tipo: pm.type || 'card',
            marca: pm.card?.brand || null,
            ultimos_digitos: pm.card?.last4 || null,
            expira_mes: pm.card?.exp_month || null,
            expira_anio: pm.card?.exp_year || null,
            es_predeterminado: true,
            activo: true,
          },
          { onConflict: 'stripe_payment_method_id' })
          .select('id_metodo')
          .single();

        if (metodoError) throw metodoError;
          metodoPagoLocalId = metodoInsertado.id_metodo;

        // Asegurar que solo ese método quede como predeterminado
        await supabase
          .schema("usuario")
          .from("tMetodoPago")
          .update({ es_predeterminado: false })
          .eq('id_usuario', user.id_usuario)
          .neq('id_metodo', metodoPagoLocalId);

        metodoPagoStripeId = payment_method_id;
      } else {
        // No se envió método nuevo, buscamos el predeterminado en base de datos
        const { data: metodoExistente, error: metodoExistenteError } = await supabase
          .schema("usuario")
          .from("tMetodoPago")
          .select("id_metodo, stripe_payment_method_id")
          .eq("id_usuario", user.id_usuario)
          .eq("es_predeterminado", true)
          .eq("activo", true)
          .maybeSingle();

        if (metodoExistenteError || !metodoExistente) {
          return res.status(400).json({
            message: "No tienes un método de pago predeterminado. Envía payment_method_id.",
          });
        }
        metodoPagoLocalId = metodoExistente.id_metodo;
        metodoPagoStripeId = metodoExistente.stripe_payment_method_id;

        if (!metodoPagoStripeId) {
          return res.status(400).json({ message: "El método de pago predeterminado no es válido." });
        }

        // Sincronizar con Stripe: asegurar que el customer tenga ese método por defecto
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: metodoPagoStripeId,
          },
        });
      }

      if (!metodoPagoStripeId) {
        return res.status(400).json({ message: "No se pudo determinar el método de pago." });
      }
      const paymentMethod: string = metodoPagoStripeId;

      // Cancelar inmediatamente cualquier suscripción de prueba activa en Stripe
      const trialingSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'trialing',
        limit: 5,
      });

      for (const trialSub of trialingSubs.data) {
        await stripe.subscriptions.cancel(trialSub.id); // Elimina la suscripción de inmediato
      }

      // Obtener el nombre y precio del plan desde la base de datos
      const { data: plan, error: planError } = await supabase
        .schema("usuario")
        .from("tTipoSuscripcion")
        .select("nombre, precio")
        .eq("stripe_price_id", price_id)
        .single();

      if (planError || !plan) {
        return res.status(400).json({ message: "Plan no encontrado para el price_id proporcionado." });
      }

      // Crear la suscripción en Stripe (cobro inmediato)
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: price_id }],
        default_payment_method: paymentMethod,
        expand: ['latest_invoice.payment_intent'],
        metadata: { id_usuario: user.id_usuario },
      });

      // Verificar que la suscripción esté activa (pago exitoso)
      if (subscription.status !== 'active') {
        return res.status(402).json({
          message: "El pago no se pudo completar. Revisa tu método de pago.",
        });
      }

      const invoice = (subscription as any).latest_invoice;
      const paymentIntent = invoice?.payment_intent;

      // Registrar en la base de datos con la función convertir_a_plan_pago
      const { error: convertError } = await supabase
        .schema("usuario")
        .rpc("convertir_a_plan_pago", {
          _id_usuario: user.id_usuario,
          _nombre_plan: plan.nombre,
          _stripe_subscription_id: subscription.id,
          _stripe_payment_intent_id: paymentIntent?.id || null,
          _stripe_invoice_id: invoice?.id || null,
          _monto: paymentIntent?.amount ? paymentIntent.amount / 100 : plan.precio,
          _id_metodo_pago: metodoPagoLocalId,
        });

      if (convertError) throw convertError;

      return res.json({
        message: "Suscripción creada exitosamente",
        subscription_id: subscription.id,
        plan: plan.nombre,
        monto: paymentIntent?.amount ? paymentIntent.amount / 100 : plan.precio,
      });

    } catch (error: any) {
      await logError(req, error, "Subscription", "subscribe", "usuario", "lStripe");
      return res.status(500).json({ message: error.message || "Error al crear la suscripción" });
    }
  }

  async changePlan(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { new_price_id } = req.body;

      const { data: sub } = await supabase
        .schema("usuario")
        .from("tUsuarioSuscripcion")
        .select("stripe_subscription_id")
        .eq("id_usuario", user.id_usuario)
        .eq("estado", "activa")
        .not("stripe_subscription_id", "is", null)
        .single();

      if (!sub)
        return res.status(404).json({ message: "No subscription" });

      const stripeSub = await stripe.subscriptions.retrieve(
        sub.stripe_subscription_id
      );

      const subscriptionItem = stripeSub.items.data[0];

    if (!subscriptionItem) {
    return res.status(400).json({
        message: "La suscripción no tiene items válidos"
    });
    }

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
    items: [
        {
        id: subscriptionItem.id,
        price: new_price_id
        }
    ],
    proration_behavior: "create_prorations"
    });

      return res.json({ message: "Plan actualizado" });

    } catch (error) {
      return res.status(500).json({ message: "Error" });
    }
  }

  async cancel(req: Request, res: Response) {
    try {
      const user = (req as any).user;

      const { data: sub } = await supabase
        .schema("usuario")
        .from("tUsuarioSuscripcion")
        .select("stripe_subscription_id")
        .eq("id_usuario", user.id_usuario)
        .eq("estado", "activa")
        .single();

      if (!sub?.stripe_subscription_id)
        return res.status(400).json({ message: "No plan de pago activo" });

      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: true
      });

      await supabase
        .schema("usuario")
        .rpc("cancelar_suscripcion", {
          _id_usuario: user.id_usuario
        });

      return res.json({
        message: "Cancelada al finalizar periodo"
      });

    } catch (error) {
      return res.status(500).json({ message: "Error" });
    }
  }
}

export const subscriptionController = new SubscriptionController();