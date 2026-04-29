import { Request, Response } from "express";
import supabase from "../database";
import bcrypt from "bcrypt";
import { RegisterUser } from "../interfaces/authInterface";
import { logError } from "../util/logError";
import { generateAccessToken, generateRefreshToken, hashRefreshToken, getRefreshTokenExpiry, TokenPayload, verifyRefreshToken } from "../util/tokenUtil";
import { sendCodeVerificationEmail, sendSecurityAlertEmail, sendWelcomeEmail, sendPasswordResetCode, sendPasswordChangedConfirmation } from '../services/emailService';
import { generateSixDigitCode } from "../util/codeGenerator";
import jwt from 'jsonwebtoken';

class AuthController {

    constructor() {
        this.register = this.register.bind(this);
        this.login = this.login.bind(this);
        this.registrarIntentoFallido = this.registrarIntentoFallido.bind(this);
    }

    /**
     * POST /api/auth/register
     * Crea un nuevo usuario en el sistema.
     */
    public async register(req: Request, res: Response) {
        try {
            const user: RegisterUser = req.body;

            const {
                nombre_usuario,
                apellido_materno,
                apellido_paterno,
                correo_electronico,
                numero_telefono,
                fecha_nacimiento,
                sexo_usuario,
                contrasena,
                acepta_aviso_privacidad,
                acepta_terminos_condiciones
            } = user;

            // Limpieza de variables
            const nombre = nombre_usuario?.trim().replace(/\s+/g, ' ');;
            const aPaterno = apellido_paterno?.trim();
            const aMaterno = apellido_materno?.trim();
            const correo = correo_electronico?.trim().toLowerCase();
            const telefono = numero_telefono?.trim().replace(/[^\d+]/g, '');

            const errores = [];
            const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
            const telefonoRegex = /^\+?[0-9]{10,15}$/;
            const nombreRegex = /^[A-Za-zÁÉÍÓÚáéíóúÜüÑñ]+(?:\s[A-Za-zÁÉÍÓÚáéíóúÜüÑñ]+)*$/;
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,70}$/;

            // Validaciones básicas
            if (!nombre || !aPaterno || !correo || !contrasena || !telefono) {
                errores.push("Los campos nombre_usuario, apellido_paterno, correo_electronico, numero_telefono y contraseña son obligatorios");
            }

            if (nombre.length < 3 || nombre.length > 50) {
                errores.push("El nombre de usuario debe tener entre 3 y 50 caracteres");
            }

            if (!aPaterno || aPaterno.length < 5 || aPaterno.length > 50) {
                errores.push("El apellido paterno debe tener entre 5 y 50 caracteres");
            }

            if (correo.length < 10 || correo.length > 100) {
                errores.push("El correo electrónico debe tener entre 10 y 100 caracteres");
            }

            if (telefono.length < 10 || telefono.length > 15) {
                errores.push("El número de teléfono debe tener entre 10 y 15 caracteres");
            }

            if (contrasena.length < 8) {
                errores.push("La contraseña debe tener más de 8 caracteres");
            }

            if (contrasena.length > 70) {
                errores.push("La contraseña debe tener menos de 70 caracteres");
            }

            if (!passwordRegex.test(contrasena)) {
                errores.push("La contraseña debe tener al menos una letra mayuscula, una letra minuscula, un número, un caracter especial y sin espacios");
            }

            if (!emailRegex.test(correo)) { // Validación de formato de email.
                errores.push("El correo electrónico no tiene un formato válido");
            }

            if (!telefonoRegex.test(telefono)) { // Validación de formato de teléfono.
                errores.push("El teléfono debe tener entre 10 y 15 dígitos (puede incluir '+')");
            }

            if (!nombreRegex.test(nombre)) { // Validación de formato de nombre de usuario.
                errores.push("El nombre de usuario solo puede contener letras y espacios");
            }

            if (fecha_nacimiento) {
                const nacimiento = new Date(fecha_nacimiento);
                if (isNaN(nacimiento.getTime())) {
                    errores.push("La fecha de nacimiento no es válida");
                } else {
                    const hoy = new Date();
                    if (nacimiento > hoy) {
                        errores.push("La fecha no puede ser futura")
                    }
                    let edad = hoy.getFullYear() - nacimiento.getFullYear();
                    if (edad > 110) {
                        errores.push("La edad no puede ser mayor a 110 años")
                    }
                    const aunNoCumple =
                        hoy.getMonth() < nacimiento.getMonth() ||
                            (
                                hoy.getMonth() === nacimiento.getMonth() &&
                                hoy.getDate() < nacimiento.getDate()
                            );
                    if (aunNoCumple) edad--;
                    if (edad < 18) {
                        errores.push("Debes ser mayor de 18 años");
                    }
                }
            }

            if (!acepta_aviso_privacidad || !acepta_terminos_condiciones) {
                errores.push("Debes aceptar el aviso de privacidad y los términos y condiciones");
            }

            if (errores.length > 0) {
                return res.status(400).json({ errors: errores });
            }

            // Hash de contraseña
            let contrasena_hash: string;
            try {
                const saltRounds = process.env.NODE_ENV === 'production' ? 12 : 10;
                contrasena_hash = await bcrypt.hash(contrasena, saltRounds);
            } catch (hashError) {
                await logError(req, hashError, 'AuthController', 'register', 'usuario', 'lAcceso');
                return res.status(500).json({ message: "Error interno al procesar la contraseña" });
            }

            const defaultRole = Number(process.env.DEFAULT_ROLE_ID || 2);
            const rolFinal = defaultRole;

            const { data, error } = await  supabase.schema('usuario')
            .rpc('registrar_usuario', {
                _nombre_usuario: nombre,
                _apellido_paterno: aPaterno || null,
                _apellido_materno: aMaterno || null,
                _correo_electronico: correo,
                _numero_telefono: telefono,
                _fecha_nacimiento: fecha_nacimiento || null,
                _sexo_usuario: sexo_usuario || null,
                _contrasena_hash: contrasena_hash,
                _id_rol_usuario: rolFinal,
                _acepta_aviso_privacidad: acepta_aviso_privacidad,
                _acepta_terminos_condiciones: acepta_terminos_condiciones
            });

            if (error) {
                await logError(req, error, 'AuthController', 'register', 'usuario', 'lAcceso');
                
                if (error.message?.includes('duplicate key')) {
                    return res.status(409).json({ message: "El correo ya está registrado" });
                }
                return res.status(500).json({ message: "Error al registrar el usuario" });
            }

            const nuevoUsuario = data;
            const userId = nuevoUsuario.id;

            // Respuesta exitosa de registro
            res.status(201).json({
                message: "Usuario registrado exitosamente",
                user: {
                    id: userId,
                    nombre_usuario: nuevoUsuario.nombre_usuario,
                    correo_electronico: nuevoUsuario.correo_electronico
                },
                next_step: "verify-email"
            });

        } catch (err: any) {
            await logError(req, err, 'AuthController', 'register', 'usuario', 'lAcceso');
            res.status(500).json({ error: "Error en el servidor" });
        }
    }

    /**
     * POST /api/auth/login
     * Inicio de sesión de usuario existente.
     */
    public async login(req: Request, res: Response) {
        try {
            const { correo, contrasena } = req.body;

            if (!correo || !contrasena) {
                return res.status(400).json({ message: "Correo y contraseña son obligatorios" });
            }

            const { data: user, error: userError } = await supabase
                .schema('usuario')
                .from('tUsuario')
                .select('id_usuario, nombre_usuario, correo_electronico, correo_verificado, contrasena_hash, id_rol_usuario')
                .eq('correo_electronico', correo.toLowerCase().trim())
                .maybeSingle();

            if (userError) {
                await logError(req, userError, 'AuthController', 'login', 'usuario', 'lAcceso');
                return res.status(500).json({ message: "Error al buscar usuario" });
            }

            if (!user) {
                await this.registrarIntentoFallido(null, req);
                return res.status(401).json({ message: "Credenciales inválidas" });
            }

            const { data: acceso, error: accesoError } = await supabase
                .schema('usuario')
                .from('tAcceso')
                .select('intentos_fallidos, bloqueado_hasta')
                .eq('id_usuario', user.id_usuario)
                .maybeSingle();

            if (accesoError) {
                await logError(req, accesoError, 'AuthController', 'login', 'usuario', 'lAcceso', user.id_usuario);
            }

            if (acceso?.bloqueado_hasta && new Date(acceso.bloqueado_hasta) > new Date()) {
                const minutosRestantes = Math.ceil((new Date(acceso.bloqueado_hasta).getTime() - Date.now()) / 60000);
                return res.status(423).json({
                    message: `Cuenta bloqueada. Intente nuevamente en ${minutosRestantes} minutos`
                });
            }

            const passwordMatch = await bcrypt.compare(contrasena, user.contrasena_hash);
            if (!passwordMatch) {
                await this.registrarIntentoFallido(user.id_usuario, req);
                return res.status(401).json({ message: "Credenciales inválidas" });
            }

            if (user.correo_verificado == false) {
                return res.status(403).json({ message: "El correo no está verificado"})
            }

            // Login exitoso
            const ahora = new Date();
            const { error: updateError } = await supabase
                .schema('usuario')
                .from('tAcceso')
                .update({
                    ultimo_acceso: ahora,
                    intentos_fallidos: 0,
                    bloqueado_hasta: null,
                    updated_at: ahora
                })
                .eq('id_usuario', user.id_usuario);

            if (updateError) {
                await logError(req, updateError, 'AuthController', 'login_update_acceso', 'usuario', 'lAcceso', user.id_usuario);
            }

            // Obtener IP y user agent para la alerta y la sesión
            const realIp = (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress) as string;
            const userAgent = req.headers['user-agent'] || 'Desconocido';

            // Enviar alerta de seguridad (sin bloquear)
            sendSecurityAlertEmail(
                user.correo_electronico,
                user.nombre_usuario,
                realIp,
                userAgent,
                ahora
            ).catch(err => {
                logError(req, err, 'AuthController', 'sendSecurityAlertEmail', 'usuario', 'lAcceso', user.id_usuario);
            });

            // Obtener suscripción activa
            const { data: suscripcion, error: subError } = await supabase
                .schema('usuario')
                .from('tUsuarioSuscripcion')
                .select(`
                    id_suscripcion,
                    fecha_inicio,
                    fecha_fin,
                    estado,
                    convertida_desde_prueba,
                    cancelar_al_vencer,
                    id_tipo_suscripcion,
                    tTipoSuscripcion (
                        nombre,
                        descripcion,
                        duracion_dias,
                        precio,
                        moneda,
                        max_pacientes,
                        max_citas_mes,
                        max_recetas_mes,
                        es_prueba,
                        requiere_metodo_pago,
                        stripe_price_id
                    )
                `)
                .eq('id_usuario', user.id_usuario)
                .eq('estado', 'activa')   // Solo la suscripción activa (índice único garantiza una)
                .maybeSingle();

            if (subError) {
                await logError(req, subError, 'AuthController', 'login_suscripcion', 'usuario', 'lAcceso', user.id_usuario);
            }

            let suscripcionInfo = null;
            if (suscripcion) {
                const tipoData = Array.isArray(suscripcion.tTipoSuscripcion)
                    ? suscripcion.tTipoSuscripcion[0]
                    : suscripcion.tTipoSuscripcion;
                suscripcionInfo = {
                    id: suscripcion.id_suscripcion,
                    tipo: tipoData?.nombre || null,
                    descripcion: tipoData?.descripcion || null,
                    duracion_dias: tipoData?.duracion_dias || null,
                    precio: tipoData?.precio || null,
                    moneda: tipoData?.moneda || null,
                    fecha_inicio: suscripcion.fecha_inicio,
                    fecha_fin: suscripcion.fecha_fin,
                    estado: suscripcion.estado,
                    vigente: suscripcion.fecha_fin ? new Date(suscripcion.fecha_fin) > new Date() : true,
                    max_pacientes: tipoData?.max_pacientes,
                    max_citas_mes: tipoData?.max_citas_mes,
                    max_recetas_mes: tipoData?.max_recetas_mes,
                    es_prueba: tipoData?.es_prueba,
                    requiere_metodo_pago: tipoData?.requiere_metodo_pago,
                    cancelar_al_vencer: suscripcion.cancelar_al_vencer
                };
            }

            const tokenPayload: TokenPayload = {
                id_usuario: user.id_usuario,
                nombre_usuario: user.nombre_usuario,
                correo_electronico: user.correo_electronico,
                id_rol_usuario: user.id_rol_usuario
            };

            const accessToken = generateAccessToken(tokenPayload);
            const refreshToken = generateRefreshToken(tokenPayload);
            const refreshTokenHash = await hashRefreshToken(refreshToken);
            const expiresAt = getRefreshTokenExpiry();

            const MAX_ACTIVE_SESSIONS = 3;

            // Contar sesiones activas actuales
            const { count, error: countError } = await supabase
                .schema('usuario')
                .from('tSesion')
                .select('*', { count: 'exact', head: true })
                .eq('id_usuario', user.id_usuario)
                .eq('revoked', false)
                .gt('expires_at', ahora.toISOString());

            if (countError) {
                await logError(req, countError, 'AuthController', 'login_count_sessions', 'usuario', 'lAcceso', user.id_usuario);
            }

            // Si hay más de MAX_ACTIVE_SESSIONS - 1 (porque vamos a insertar una nueva), revocamos las más antiguas
            if (count && count >= MAX_ACTIVE_SESSIONS) {
                const sessionsToRevoke = count - MAX_ACTIVE_SESSIONS + 1;

                // Obtener los IDs de las sesiones más antiguas (ordenadas por created_at ascendente)
                const { data: oldestSessions, error: fetchError } = await supabase
                    .schema('usuario')
                    .from('tSesion')
                    .select('id_sesion')
                    .eq('id_usuario', user.id_usuario)
                    .eq('revoked', false)
                    .gt('expires_at', ahora.toISOString())
                    .order('created_at', { ascending: true })
                    .limit(sessionsToRevoke);

                if (!fetchError && oldestSessions && oldestSessions.length > 0) {
                    const idsToRevoke = oldestSessions.map(s => s.id_sesion);
                    const { error: revokeError } = await supabase
                        .schema('usuario')
                        .from('tSesion')
                        .update({ revoked: true, revoked_at: ahora })
                        .in('id_sesion', idsToRevoke);

                    if (revokeError) {
                        await logError(req, revokeError, 'AuthController', 'login_revoke_old_sessions', 'usuario', 'lAcceso', user.id_usuario);
                    }
                }
            }

            // Insertar la nueva sesión
            const { error: sessionError } = await supabase
                .schema('usuario')
                .from('tSesion')
                .insert({
                    id_usuario: user.id_usuario,
                    refresh_token_hash: refreshTokenHash,
                    ip_address: realIp,
                    user_agent: userAgent,
                    expires_at: expiresAt,
                    revoked: false
                });

            if (sessionError) {
                await logError(req, sessionError, 'AuthController', 'login', 'usuario', 'lAcceso', user.id_usuario);
                return res.status(500).json({ message: "Error al iniciar sesión" });
            }

            res.cookie('refresh_token', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', // solo HTTPS en producción
                sameSite: 'strict',
                path: '/api/auth/refresh-token', // solo se envía en esta ruta
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 días
            });

            res.status(200).json({
                message: "Inicio de sesión exitoso",
                user: {
                    id: user.id_usuario,
                    nombre_usuario: user.nombre_usuario,
                    correo_electronico: user.correo_electronico,
                    suscripcion: suscripcionInfo
                },
                tokens: {
                    access_token: accessToken,
                    expires_in: process.env.JWT_ACCESS_EXPIRES_IN
                }
            });

        } catch (err: any) {
            await logError(req, err, 'AuthController', 'login', 'usuario', 'lAcceso');
            res.status(500).json({ error: "Error en el servidor" });
        }
    }

    /**
     * POST /api/auth/send-verification-code
     * Envía código de verificación para validar correo.
     */
    public async sendVerificationCode(req: Request, res: Response) {
        try {
            const { correo } = req.body;
            if (!correo) {
                return res.status(400).json({ message: "El correo electrónico es requerido" });
            }

            // Buscar usuario por correo
            const { data: user, error: userError } = await supabase
                .schema('usuario')
                .from('tUsuario')
                .select('id_usuario, nombre_usuario, correo_verificado')
                .eq('correo_electronico', correo)
                .maybeSingle();

            if (userError || !user) {
                // Por seguridad, no revelamos si el correo existe
                return res.status(200).json({ message: "Si el correo existe y no está verificado, recibirás un código" });
            }

            if (user.correo_verificado) {
                return res.status(400).json({ message: "El correo ya ha sido verificado" });
            }

            // Eliminar códigos anteriores no usados del mismo usuario.
            await supabase
                .schema('sistema')
                .from('tCodigosVerificacion')
                .delete()
                .eq('id_usuario', user.id_usuario)
                .eq('usado', false);

            // Generar código de 6 dígitos
            const code = generateSixDigitCode();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

            // Guardar en base de datos
            const { error: insertError } = await supabase
                .schema('sistema')
                .from('tCodigosVerificacion')
                .insert({
                    id_usuario: user.id_usuario,
                    codigo: code,
                    expira: expiresAt,
                    usado: false
                });

            if (insertError) {
                await logError(req, insertError, 'AuthController', 'sendVerificationCode', 'sistema', 'tCodigosVerificacion', user.id_usuario);
                return res.status(500).json({ message: "Error al generar el código" });
            }

            // Enviar correo con el código
            await sendCodeVerificationEmail(correo, code, user.nombre_usuario);
            res.status(200).json({ message: "Código de verificación enviado. Revisa tu correo." });

        } catch (err: any) {
            await logError(req, err, 'AuthController', 'sendVerificationCode', 'sistema', 'tCodigosVerificacion');
            res.status(500).json({ error: "Error en el servidor" });
        }
    }

    /**
     * POST /api/auth/verify-email
     * Verifica el código de verificación para validar correo.
     */
    public async verifyEmail(req: Request, res: Response) {
        try {
            const { correo, codigo } = req.body;
            if (!correo || !codigo) {
                return res.status(400).json({ message: "Correo y código son obligatorios" });
            }

            // Buscar usuario
            const { data: user, error: userError } = await supabase
                .schema('usuario')
                .from('tUsuario')
                .select('id_usuario, nombre_usuario, correo_electronico, correo_verificado, id_rol_usuario')
                .eq('correo_electronico', correo)
                .maybeSingle();

            if (userError || !user) {
                return res.status(404).json({ message: "Usuario no encontrado" });
            }

            if (user.correo_verificado) {
                return res.status(400).json({ message: `El correo ${correo} ya está verificado` });
            }

            // Buscar código válido
            const { data: codigoReg, error: codeError } = await supabase
                .schema('sistema')
                .from('tCodigosVerificacion')
                .select('id_codigo, expira, usado')
                .eq('id_usuario', user.id_usuario)
                .eq('codigo', codigo)
                .eq('usado', false)
                .maybeSingle();

            if (codeError || !codigoReg) {
                return res.status(400).json({ message: "Código inválido o ya usado" });
            }

            // Verificar expiración
            if (new Date(codigoReg.expira) < new Date()) {
                return res.status(400).json({ message: "El código ha expirado. Solicita uno nuevo." });
            }

            // Marcar código como usado
            await supabase
                .schema('sistema')
                .from('tCodigosVerificacion')
                .update({ usado: true })
                .eq('id_codigo', codigoReg.id_codigo);

            // Actualizar usuario: correo_verificado = true
            const { error: updateError } = await supabase
                .schema('usuario')
                .from('tUsuario')
                .update({
                    correo_verificado: true,
                    updated_at: new Date()
                })
                .eq('id_usuario', user.id_usuario);

            if (updateError) {
                await logError(req, updateError, 'AuthController', 'verifyEmail', 'usuario', 'tUsuario', user.id_usuario);
                return res.status(500).json({ message: "Error al verificar el correo" });
            }

            // Preparar payload del token
            const tokenPayload: TokenPayload = {
                id_usuario: user.id_usuario,
                nombre_usuario: user.nombre_usuario,
                correo_electronico: user.correo_electronico,
                id_rol_usuario: user.id_rol_usuario
            };

            const accessToken = generateAccessToken(tokenPayload);
            const refreshToken = generateRefreshToken(tokenPayload);
            const refreshTokenHash = await hashRefreshToken(refreshToken);
            const expiresAt = getRefreshTokenExpiry();

            // Guardar sesión
            const realIp = (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress) as string;
            const { error: sessionError } = await supabase
                .schema('usuario')
                .from('tSesion')
                .insert({
                    id_usuario: user.id_usuario,
                    refresh_token_hash: refreshTokenHash,
                    ip_address: realIp,
                    user_agent: req.headers['user-agent'] || 'Desconocido',
                    expires_at: expiresAt,
                    revoked: false
                });

            if (sessionError) {
                await logError(req, sessionError, 'AuthController', 'verifyEmail', 'usuario', 'tSesion', user.id_usuario);
            }

            sendWelcomeEmail(correo, user.nombre_usuario).catch(err => {
                logError(req, err, 'AuthController', 'sendWelcomeEmail', 'usuario', 'lAcceso', user.id_usuario);
            });

            res.cookie('refresh_token', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                path: '/api/auth/refresh-token',
                maxAge: 30 * 24 * 60 * 60 * 1000
            });

            res.status(200).json({
                message: "Correo verificado exitosamente",
                user: {
                    id: user.id_usuario,
                    nombre_usuario: user.nombre_usuario,
                    correo_electronico: user.correo_electronico,
                    correo_verificado: true
                },
                tokens: {
                    access_token: accessToken,
                    expires_in: process.env.JWT_ACCESS_EXPIRES_IN
                }
            });

        } catch (err: any) {
            await logError(req, err, 'AuthController', 'verifyEmail', 'sistema', 'tCodigosVerificacion');
            res.status(500).json({ error: "Error en el servidor" });
        }
    }

    /**
     * POST /api/auth/send-password-reset-code
     * Envía código de verificación para cambiar contraseña.
     */
    public async sendChangePasswordCode(req: Request, res: Response) {
        try {
            const { correo } = req.body;
            if (!correo) {
                return res.status(400).json({ message: "El correo electrónico es requerido" });
            }

            // Normalizar correo
            const correoNormalizado = correo.toLowerCase().trim();

            // Buscar usuario por correo
            const { data: user, error: userError } = await supabase
                .schema('usuario')
                .from('tUsuario')
                .select('id_usuario, nombre_usuario, correo_electronico, correo_verificado')
                .eq('correo_electronico', correoNormalizado)
                .maybeSingle();

            if (userError) {
                await logError(req, userError, 'AuthController', 'sendChangePasswordCode', 'usuario', 'tUsuario');
                return res.status(500).json({ message: "Error al buscar el usuario" });
            }

            // Por seguridad, no revelamos si el correo existe o no
            if (!user) {
                return res.status(200).json({ 
                    message: "Si el correo está registrado, recibirás un código para restablecer tu contraseña" 
                }); 
            }

            // Verificar que el correo esté verificado antes de permitir reset
            if (!user.correo_verificado) {
                return res.status(403).json({ 
                    message: "Debes verificar tu correo electrónico antes de restablecer la contraseña" 
                });
            }

            // Eliminar códigos de restablecimiento previos no usados para este usuario
            await supabase
                .schema('sistema')
                .from('tCodigosVerificacion')
                .delete()
                .eq('id_usuario', user.id_usuario)
                .eq('usado', false);

            // Generar código de 6 dígitos
            const code = generateSixDigitCode();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

            // Guardar en base de datos
            const { error: insertError } = await supabase
                .schema('sistema')
                .from('tCodigosVerificacion')
                .insert({
                    id_usuario: user.id_usuario,
                    codigo: code,
                    expira: expiresAt,
                    usado: false
                });

            if (insertError) {
                await logError(req, insertError, 'AuthController', 'sendChangePasswordCode', 'sistema', 'tCodigosVerificacion', user.id_usuario);
                return res.status(500).json({ message: "Error al generar el código de restablecimiento" });
            }

            // Enviar correo con el código
            await sendPasswordResetCode(correoNormalizado, user.nombre_usuario, code);

            res.status(200).json({ 
                message: "Código de restablecimiento enviado. Revisa tu correo." 
            });

        } catch (err: any) {
            await logError(req, err, 'AuthController', 'sendChangePasswordCode', 'sistema', 'tCodigosVerificacion');
            res.status(500).json({ error: "Error en el servidor" });
        }
    }

    /**
     * POST /api/auth/verify-password-code
     * Verifica el código de verificación para cambiar contraseña.
     */
    public async verifyPasswordCode(req: Request, res: Response) {
        try {
            const { correo, codigo } = req.body;
            if (!correo || !codigo) {
                return res.status(400).json({ message: "Correo y código son obligatorios" });
            }

            const correoNormalizado = correo.toLowerCase().trim();

            // Buscar usuario
            const { data: user, error: userError } = await supabase
                .schema('usuario')
                .from('tUsuario')
                .select('id_usuario, nombre_usuario, correo_electronico')
                .eq('correo_electronico', correoNormalizado)
                .maybeSingle();

            if (userError || !user) {
                return res.status(400).json({ message: "Código inválido o expirado" });
            }

            // Buscar código válido
            const { data: codigoReg, error: codeError } = await supabase
                .schema('sistema')
                .from('tCodigosVerificacion')
                .select('id_codigo, expira, usado')
                .eq('id_usuario', user.id_usuario)
                .eq('codigo', codigo)
                .eq('usado', false)
                .maybeSingle();

            if (codeError || !codigoReg) {
                return res.status(400).json({ message: "Código inválido o ya usado" });
            }

            // Verificar expiración
            if (new Date(codigoReg.expira) < new Date()) {
                return res.status(401).json({ message: "El código ha expirado. Solicita uno nuevo." });
            }

            // Marcar código como usado
            await supabase
                .schema('sistema')
                .from('tCodigosVerificacion')
                .update({ usado: true })
                .eq('id_codigo', codigoReg.id_codigo);

            // Generar token temporal para el restablecimiento de contraseña (10 min)
            const resetToken = jwt.sign(
                { 
                    user_id: user.id_usuario, 
                    purpose: 'password_reset',
                    email: user.correo_electronico 
                },
                process.env.JWT_ACCESS_SECRET!,
                { expiresIn: '10m' }
            );

            res.status(200).json({
                message: "Código verificado correctamente",
                reset_token: resetToken,
                expires_in: '10 minutos'
            });

        } catch (err: any) {
            await logError(req, err, 'AuthController', 'verifyPasswordCode', 'sistema', 'tCodigosVerificacion');
            res.status(500).json({ error: "Error en el servidor" });
        }
    }

    /**
     * POST /api/auth/reset-password
     * Cambia la contraseña de usuario existente.
     */
    public async resetPassword(req: Request, res: Response) {
        try {
            const { reset_token, nueva_contrasena } = req.body;
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,70}$/;

            if (!reset_token || !nueva_contrasena) {
                return res.status(400).json({ message: "Token y nueva contraseña son obligatorios" });
            }

            // Validar fortaleza de la nueva contraseña
            if (nueva_contrasena.length < 8) {
                return res.status(400).json({ message: "La contraseña debe tener al menos 8 caracteres" });
            } else if (nueva_contrasena.length > 70) {
                return res.status(400).json({ message: "La contraseña debe tener menos de 70 caracteres" });
            } else if (!passwordRegex.test(nueva_contrasena)) {
                return res.status(400).json({ message: "La contraseña debe tener al menos una letra mayuscula, una letra minuscula, un número, un caracter especial y sin espacios" });
            }

            // Verificar token JWT
            let decoded: any;
            try {
                decoded = jwt.verify(reset_token, process.env.JWT_ACCESS_SECRET!);
            } catch (err) {
                return res.status(401).json({ message: "Token inválido o expirado" });
            }

            // Validar propósito del token
            if (decoded.purpose !== 'password_reset') {
                return res.status(401).json({ message: "Token no válido para restablecimiento de contraseña" });
            }

            const userId = decoded.user_id;
            const userEmail = decoded.email;

            // Verificar que el usuario exista
            const { data: user, error: userError } = await supabase
                .schema('usuario')
                .from('tUsuario')
                .select('id_usuario, nombre_usuario, correo_electronico')
                .eq('id_usuario', userId)
                .maybeSingle();

            if (userError || !user) {
                await logError(req, userError || new Error('Usuario no encontrado'), 'AuthController', 'resetPassword', 'usuario', 'tUsuario', userId);
                return res.status(404).json({ message: "Usuario no encontrado" });
            }

            // Verificar que el correo coincida (doble seguridad)
            if (user.correo_electronico !== userEmail) {
                return res.status(401).json({ message: "Token inconsistente" });
            }

            // Hashear la nueva contraseña
            let nuevaContrasenaHash: string;
            try {
                const saltRounds = process.env.NODE_ENV === 'production' ? 12 : 10;
                nuevaContrasenaHash = await bcrypt.hash(nueva_contrasena, saltRounds);
            } catch (hashError) {
                await logError(req, hashError, 'AuthController', 'resetPassword', 'usuario', 'lAcceso', userId);
                return res.status(500).json({ message: "Error al procesar la nueva contraseña" });
            }

            // Actualizar contraseña en base de datos
            const ahora = new Date();
            const { error: updateError } = await supabase
                .schema('usuario')
                .from('tUsuario')
                .update({
                    contrasena_hash: nuevaContrasenaHash,
                    updated_at: ahora
                })
                .eq('id_usuario', userId);

            if (updateError) {
                await logError(req, updateError, 'AuthController', 'resetPassword', 'usuario', 'tUsuario', userId);
                return res.status(500).json({ message: "Error al actualizar la contraseña" });
            }

            // Invalidar todas las sesiones activas
            const { error: revokeError } = await supabase
                .schema('usuario')
                .from('tSesion')
                .update({ revoked: true, updated_at: ahora })
                .eq('id_usuario', userId)
                .eq('revoked', false);

            if (revokeError) {
                await logError(req, revokeError, 'AuthController', 'resetPassword_revoke', 'usuario', 'tSesion', userId);
            }

            // Registrar el cambio en log de seguridad (opcional)
            await logError(
                req,
                new Error('Contraseña restablecida exitosamente'),
                'AuthController',
                'resetPassword_success',
                'usuario',
                'tUsuario',
                userId
            );

            // Enviar correo de confirmación
            sendPasswordChangedConfirmation(
                user.correo_electronico,
                user.nombre_usuario,
                ahora
            ).catch(err => {
                logError(req, err, 'AuthController', 'sendPasswordChangedConfirmation', 'usuario', 'lAcceso', userId);
            });

            res.status(200).json({
                message: "Contraseña actualizada exitosamente. Por seguridad, todas las sesiones han sido cerradas."
            });

        } catch (err: any) {
            await logError(req, err, 'AuthController', 'resetPassword', 'usuario', 'lAcceso');
            res.status(500).json({ error: "Error en el servidor" });
        }
    }

    /**
     * POST /api/auth/refresh-token
     * Actualiza token para mantener sesión activa.
     */
    public async refreshToken(req: Request, res: Response) {
        try {
            const refresh_token = req.cookies?.refresh_token;

            if (!refresh_token) {
                return res.status(400).json({ message: "Refresh token es requerido" });
            }

            // Verificar que el token JWT sea válido
            let decoded: any;
            try {
                decoded = verifyRefreshToken(refresh_token);
                if (!decoded) {
                    return res.status(401).json({ message: "Refresh token inválido o expirado" });
                }
            } catch (err) {
                return res.status(401).json({ message: "Refresh token inválido o expirado" });
            }

            const userId = decoded.id_usuario;

            // Hashear el token recibido para compararlo con el almacenado
            const tokenHash = await hashRefreshToken(refresh_token);

            // Buscar la sesión activa correspondiente
            const { data: sesion, error: sessionError } = await supabase
                .schema('usuario')
                .from('tSesion')
                .select('id_sesion, refresh_token_hash, revoked, expires_at')
                .eq('id_usuario', userId)
                .eq('refresh_token_hash', tokenHash)
                .eq('revoked', false)
                .maybeSingle();

            if (sessionError || !sesion) {
                await logError(req, sessionError || new Error('Sesión no encontrada'), 'AuthController', 'refreshToken', 'usuario', 'lAcceso', userId);
                return res.status(401).json({ message: "Refresh token no válido o sesión revocada" });
            }

            // Verificar que no haya expirado en BD
            if (new Date(sesion.expires_at) < new Date()) {
                // Marcar como revocada por expiración
                await supabase
                    .schema('usuario')
                    .from('tSesion')
                    .update({ revoked: true, updated_at: new Date() })
                    .eq('id_sesion', sesion.id_sesion);
                return res.status(401).json({ message: "Refresh token expirado" });
            }

            // Obtener datos actualizados del usuario (por si cambiaron roles o correo)
            const { data: user, error: userError } = await supabase
                .schema('usuario')
                .from('tUsuario')
                .select('id_usuario, nombre_usuario, correo_electronico, id_rol_usuario')
                .eq('id_usuario', userId)
                .single();

            if (userError || !user) {
                await logError(req, userError || new Error('Usuario no encontrado'), 'AuthController', 'refreshToken', 'usuario', 'lAcceso', userId);
                return res.status(401).json({ message: "Usuario no encontrado" });
            }

            // Revocar la sesión actual (rotación de refresh token)
            const ahora = new Date();
            const { error: revokeError } = await supabase
                .schema('usuario')
                .from('tSesion')
                .update({ revoked: true, revoked_at: ahora, updated_at: ahora })
                .eq('id_sesion', sesion.id_sesion);

            if (revokeError) {
                await logError(req, revokeError, 'AuthController', 'refreshToken_revoke', 'usuario', 'lAcceso', userId);
            }

            // Generar nuevos tokens
            const tokenPayload: TokenPayload = {
                id_usuario: user.id_usuario,
                nombre_usuario: user.nombre_usuario,
                correo_electronico: user.correo_electronico,
                id_rol_usuario: user.id_rol_usuario
            };

            const newAccessToken = generateAccessToken(tokenPayload);
            const newRefreshToken = generateRefreshToken(tokenPayload);
            const newRefreshTokenHash = await hashRefreshToken(newRefreshToken);
            const expiresAt = getRefreshTokenExpiry();

            // Obtener IP y user agent actuales
            const realIp = (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress) as string;
            const userAgent = req.headers['user-agent'] || 'Desconocido';

            // Guardar nueva sesión
            const { error: insertError } = await supabase
                .schema('usuario')
                .from('tSesion')
                .insert({
                    id_usuario: user.id_usuario,
                    refresh_token_hash: newRefreshTokenHash,
                    ip_address: realIp,
                    user_agent: userAgent,
                    expires_at: expiresAt,
                    revoked: false
                });

            if (insertError) {
                await logError(req, insertError, 'AuthController', 'refreshToken_insert', 'usuario', 'lAcceso', userId);
                return res.status(500).json({ message: "Error al crear nueva sesión" });
            }

            // Establecer la nueva cookie con el nuevo refresh token
            res.cookie('refresh_token', newRefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                path: '/api/auth/refresh-token',
                maxAge: 30 * 24 * 60 * 60 * 1000
            });

            // Responder con nuevos tokens
            res.status(200).json({
                message: "Token refrescado exitosamente",
                tokens: {
                    access_token: newAccessToken,
                    expires_in: process.env.JWT_ACCESS_EXPIRES_IN
                }
            });

        } catch (err: any) {
            await logError(req, err, 'AuthController', 'refreshToken', 'usuario', 'lAcceso');
            res.status(500).json({ error: "Error en el servidor" });
        }
    }

    /**
     * Método auxiliar para registrar
     * intentos fallidos y posible bloqueo.
     */
    private async registrarIntentoFallido(id_usuario: number | null, req: Request) {
        if (!id_usuario) {
            // Si el usuario no existe, solo logueamos el intento (sin asociar a usuario)
            await logError(req, new Error("Intento de login con usuario inexistente"), 'AuthController', 'login_intento_fallido', 'usuario', 'lAcceso');
            return;
        }

        // Obtener intentos actuales
        const { data: acceso, error: fetchError } = await supabase
            .schema('usuario')
            .from('tAcceso')
            .select('intentos_fallidos, bloqueado_hasta')
            .eq('id_usuario', id_usuario)
            .maybeSingle();

        if (fetchError) {
            await logError(req, fetchError, 'AuthController', 'registrarIntentoFallido', 'usuario', 'lAcceso', id_usuario);
            return;
        }

        let nuevosIntentos = (acceso?.intentos_fallidos || 0) + 1;
        const bloqueado_hasta = nuevosIntentos >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

        const { error: updateError } = await supabase
            .schema('usuario')
            .from('tAcceso')
            .update({
                intentos_fallidos: nuevosIntentos,
                ultimo_intento_fallido: new Date(),
                bloqueado_hasta: bloqueado_hasta,
                updated_at: new Date()
            })
            .eq('id_usuario', id_usuario);

        if (updateError) {
            await logError(req, updateError, 'AuthController', 'registrarIntentoFallido', 'usuario', 'lAcceso', id_usuario);
        }

        await logError(req, new Error(`Intento fallido #${nuevosIntentos}`), 'AuthController', 'login_fallido', 'usuario', 'lAcceso', id_usuario);
    }
}

export const authController = new AuthController();