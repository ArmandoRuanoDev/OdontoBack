import { Request, Response } from "express";
import supabase from "../database";
import { logError } from "../util/logError";
import { sendCancellationEmail, sendSubscriptionEmail, sendSubscriptionReceipt } from '../services/emailService';

class SubscriptionController {

    constructor() {}

    public async subscribe(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            if (!user || !user.id_usuario) {
                return res.status(401).json({ message: "No autorizado" });
            }

            const { id_tipo_suscripcion, metodo_pago, ultimos_digitos, id_transaccion_gateway } = req.body;

            // Validaciones
            if (!id_tipo_suscripcion) {
                return res.status(400).json({ message: "El tipo de suscripción es requerido" });
            }
            if (!metodo_pago) {
                return res.status(400).json({ message: "El método de pago es requerido" });
            }

            // Obtener detalles del tipo de suscripción
            const { data: tipoSuscripcion, error: tipoError } = await supabase
                .schema('usuario')
                .from('tTipoSuscripcion')
                .select('id_tipo_suscripcion, nombre, duracion_dias, precio, moneda, activo')
                .eq('id_tipo_suscripcion', id_tipo_suscripcion)
                .eq('activo', true)
                .single();

            if (tipoError || !tipoSuscripcion) {
                await logError(req, tipoError || new Error('Tipo de suscripción no encontrado'), 'SubscriptionController', 'subscribe', 'usuario', 'lAcceso', user.id_usuario);
                return res.status(404).json({ message: "Plan de suscripción no válido" });
            }

            // Verificar si el usuario ya tiene una suscripción activa (estado = 'activa' y fecha_fin > NOW o NULL)
            const { data: suscripcionActiva, error: activeError } = await supabase
                .schema('usuario')
                .from('tUsuarioSuscripcion')
                .select('id_suscripcion, id_tipo_suscripcion, estado, fecha_fin')
                .eq('id_usuario', user.id_usuario)
                .eq('estado', 'activa')
                .or('fecha_fin.is.null,fecha_fin.gt.now()')
                .maybeSingle();

            if (activeError) {
                await logError(req, activeError, 'SubscriptionController', 'subscribe', 'usuario', 'lAcceso', user.id_usuario);
                return res.status(500).json({ message: "Error al verificar suscripción activa" });
            }

            // Si tiene una suscripción activa, la cancelamos (cambiamos estado a 'cancelada')
            if (suscripcionActiva?.id_suscripcion) {
                const { error: cancelError } = await supabase
                    .schema('usuario')
                    .from('tUsuarioSuscripcion')
                    .update({ estado: 'cancelada', updated_at: new Date() })
                    .eq('id_suscripcion', suscripcionActiva.id_suscripcion);
                if (cancelError) {
                    await logError(req, cancelError, 'SubscriptionController', 'subscribe', 'usuario', 'lAcceso', user.id_usuario);
                }
            }

            const ahora = new Date();
            let fechaFin = null;
            if (tipoSuscripcion.duracion_dias !== null && tipoSuscripcion.duracion_dias > 0) {
                fechaFin = new Date(ahora.getTime() + tipoSuscripcion.duracion_dias * 24 * 60 * 60 * 1000);
            }

            // Insertar nueva suscripción
            const { data: nuevaSuscripcion, error: insertSubError } = await supabase
                .schema('usuario')
                .from('tUsuarioSuscripcion')
                .insert({
                    id_usuario: user.id_usuario,
                    id_tipo_suscripcion: tipoSuscripcion.id_tipo_suscripcion,
                    fecha_inicio: ahora,
                    fecha_fin: fechaFin,
                    estado: 'activa',
                    created_at: ahora,
                    updated_at: null
                })
                .select()
                .single();

            if (insertSubError) {
                await logError(req, insertSubError, 'SubscriptionController', 'subscribe', 'usuario', 'lAcceso', user.id_usuario);
                return res.status(500).json({ message: "Error al crear la suscripción" });
            }

            // Insertar registro de pago
            const { error: pagoError } = await supabase
                .schema('usuario')
                .from('tPago')
                .insert({
                    id_suscripcion: nuevaSuscripcion.id_suscripcion,
                    monto: tipoSuscripcion.precio,
                    moneda: tipoSuscripcion.moneda,
                    fecha_pago: ahora,
                    metodo_pago: metodo_pago,
                    ultimos_digitos: ultimos_digitos || null,
                    id_transaccion_gateway: id_transaccion_gateway || null,
                    estado_pago: 'exitoso'
                });

            if (pagoError) {
                await logError(req, pagoError, 'SubscriptionController', 'subscribe', 'usuario', 'lAcceso', user.id_usuario);
            }

            var prueba = false
            if (tipoSuscripcion.id_tipo_suscripcion == 3)
                prueba = true;

            sendSubscriptionEmail(
                user.correo_electronico,
                user.nombre_usuario,
                tipoSuscripcion.nombre,
                tipoSuscripcion.precio,
                tipoSuscripcion.moneda,
                ahora,
                fechaFin,
                prueba
            ).catch(err => {
                console.error('Error al enviar correo de suscripción:', err);
                logError(req, err, 'SubscriptionController', 'sendSubscriptionEmail', 'usuario', 'lAcceso', user.id_usuario);
            });

            var subtotal = tipoSuscripcion.precio / 1.16
            var tax = subtotal * 0.16

            sendSubscriptionReceipt(
                user.correo_electronico,
                user.nombre_usuario,
                tipoSuscripcion.nombre,
                subtotal,
                tax,
                tipoSuscripcion.precio,
                tipoSuscripcion.moneda,
                ahora,
                fechaFin,
                id_transaccion_gateway,
                metodo_pago,
                prueba
            )

            // Respuesta exitosa
            res.status(201).json({
                message: "Suscripción activada correctamente",
                suscripcion: {
                    id: nuevaSuscripcion.id_suscripcion,
                    plan: tipoSuscripcion.nombre,
                    fecha_inicio: nuevaSuscripcion.fecha_inicio,
                    fecha_fin: nuevaSuscripcion.fecha_fin,
                    estado: nuevaSuscripcion.estado
                }
            });

        } catch (err: any) {
            await logError(req, err, 'SubscriptionController', 'subscribe', 'usuario', 'lAcceso');
            res.status(500).json({ error: "Error en el servidor" });
        }
    }

    public async cancelSubscription(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            if (!user || !user.id_usuario) {
                return res.status(401).json({ message: "No autorizado" });
            }

            // Buscar la suscripción activa actual del usuario
            const { data: suscripcion, error: findError } = await supabase
                .schema('usuario')
                .from('tUsuarioSuscripcion')
                .select(`
                    id_suscripcion,
                    id_tipo_suscripcion,
                    fecha_fin,
                    tTipoSuscripcion (nombre)
                `)
                .eq('id_usuario', user.id_usuario)
                .eq('estado', 'activa')
                .or('fecha_fin.is.null,fecha_fin.gt.now()')
                .maybeSingle();

            if (findError || !suscripcion) {
                await logError(req, findError || new Error('No active subscription'), 'SubscriptionController', 'cancelSubscription', 'usuario', 'lAcceso', user.id_usuario);
                return res.status(404).json({ message: "No tienes una suscripción activa para cancelar" });
            }

            // Actualizar la suscripción a 'cancelada' (mantenemos fecha_fin original)
            const { error: updateError } = await supabase
                .schema('usuario')
                .from('tUsuarioSuscripcion')
                .update({
                    estado: 'cancelada',
                    updated_at: new Date()
                })
                .eq('id_suscripcion', suscripcion.id_suscripcion);

            if (updateError) {
                await logError(req, updateError, 'SubscriptionController', 'cancelSubscription', 'usuario', 'lAcceso', user.id_usuario);
                return res.status(500).json({ message: "Error al cancelar la suscripción" });
            }

            // Si es de por vida (fecha_fin NULL), insertar inmediatamente el plan 'Inicio'
            if (suscripcion.fecha_fin === null) {
                const { data: planInicio, error: planError } = await supabase
                    .schema('usuario')
                    .from('tTipoSuscripcion')
                    .select('id_tipo_suscripcion')
                    .eq('nombre', 'Inicio')
                    .eq('activo', true)
                    .single();

                if (planError) {
                    await logError(req, planError, 'SubscriptionController', 'cancelSubscription', 'usuario', 'lAcceso', user.id_usuario);
                } else {
                    // Verificar que no exista ya una suscripción activa de Inicio para este usuario
                    const { data: existeInicio } = await supabase
                        .schema('usuario')
                        .from('tUsuarioSuscripcion')
                        .select('id_suscripcion')
                        .eq('id_usuario', user.id_usuario)
                        .eq('estado', 'activa')
                        .eq('id_tipo_suscripcion', planInicio.id_tipo_suscripcion)
                        .maybeSingle();

                    if (!existeInicio) {
                        const { error: insertInicioError } = await supabase
                            .schema('usuario')
                            .from('tUsuarioSuscripcion')
                            .insert({
                                id_usuario: user.id_usuario,
                                id_tipo_suscripcion: planInicio.id_tipo_suscripcion,
                                fecha_inicio: new Date(),
                                fecha_fin: null,
                                estado: 'activa'
                            });
                        if (insertInicioError) {
                            await logError(req, insertInicioError, 'SubscriptionController', 'cancelSubscription', 'usuario', 'lAcceso', user.id_usuario);
                        }
                    }
                }
            } else {
                // Para suscripciones con fecha_fin futura, ejecutar la función que insertará 'Inicio' cuando expire
                const { error: rpcError } = await supabase
                    .schema('usuario')
                    .rpc('finalizar_suscripcion_a_inicio');
                if (rpcError) {
                    console.error('Error al ejecutar finalizar_suscripcion_a_inicio:', rpcError);
                    await logError(req, rpcError, 'SubscriptionController', 'cancelSubscription', 'usuario', 'lAcceso', user.id_usuario);
                }
            }

            // Enviar correo de confirmación de cancelación
            const tipoSuscripcionObj = Array.isArray(suscripcion.tTipoSuscripcion)
                ? suscripcion.tTipoSuscripcion[0]
                : suscripcion.tTipoSuscripcion;
            const planNombre = tipoSuscripcionObj?.nombre || 'plan';

            await sendCancellationEmail(
                user.correo_electronico,
                user.nombre_usuario,
                planNombre,
                suscripcion.fecha_fin ? new Date(suscripcion.fecha_fin) : null
            ).catch(err => {
                console.error('Error al enviar correo de cancelación:', err);
                logError(req, err, 'SubscriptionController', 'sendCancellationEmail', 'usuario', 'lAcceso', user.id_usuario);
            });

            res.status(200).json({
                message: "Suscripción cancelada exitosamente. Seguirás teniendo acceso hasta la fecha de expiración.",
                fecha_fin: suscripcion.fecha_fin
            });

        } catch (err: any) {
            await logError(req, err, 'SubscriptionController', 'cancelSubscription', 'usuario', 'lAcceso');
            res.status(500).json({ error: "Error en el servidor" });
        }
    }
}

export const subscriptionController = new SubscriptionController();