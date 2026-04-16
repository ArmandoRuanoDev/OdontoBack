import { Request, Response, NextFunction } from 'express';
import supabase from '../database';
import { logError } from '../util/logError';

export const requirePaidSubscription = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;
        if (!user?.id_usuario) {
            return res.status(401).json({ message: 'No autorizado' });
        }

        // Obtener suscripción vigente
        const { data, error } = await supabase
            .schema('usuario')
            .from('tUsuarioSuscripcion')
            .select('id_suscripcion, estado, fecha_fin, id_tipo_suscripcion')
            .eq('id_usuario', user.id_usuario)
            .or('estado.eq.activa,and(estado.eq.cancelada,fecha_fin.gt.now())')
            .order('fecha_inicio', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            await logError(req, error, 'requirePaidSubscription', 'middleware', 'usuario', 'lAcceso', user.id_usuario);
            return res.status(500).json({ message: 'Error al verificar suscripción' });
        }

        // Si no hay suscripción vigente o es plan Inicio (id=5) denegar
        if (!data || data.id_tipo_suscripcion === 5) {
            return res.status(403).json({
                message: 'Acceso denegado. Se requiere una suscripción activa.',
                code: 'SUBSCRIPTION_REQUIRED'
            });
        }

        // Permitir el acceso (incluso si está cancelada pero dentro del período de gracia)
        (req as any).subscription = data;
        next();
    } catch (err) {
        await logError(req, err, 'requirePaidSubscription', 'middleware', 'usuario', 'lAcceso');
        res.status(500).json({ error: 'Error en el servidor' });
    }
};