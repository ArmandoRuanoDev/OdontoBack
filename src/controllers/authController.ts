import { Request, Response } from "express";
import supabase from "../database";
import bcrypt from "bcrypt";
import { RegisterUser } from "../interfaces/authInterface";
import { logError } from "../util/logError";
import { generateAccessToken, generateRefreshToken, hashRefreshToken, getRefreshTokenExpiry, TokenPayload } from "../util/tokenUtil";
import { sendWelcomeEmail } from '../services/emailService';

class AuthController {

    constructor() {
        this.register = this.register.bind(this);
        this.login = this.login.bind(this);
        this.registrarIntentoFallido = this.registrarIntentoFallido.bind(this);
    }

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
                id_rol_usuario,
                acepta_aviso_privacidad,
                acepta_terminos_condiciones
            } = user;

            const errores = [];
            const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
            const telefonoRegex = /^\+?[0-9]{10,13}$/;
            const usernameRegex = /^[a-zA-Z]+(?: [a-zA-Z]+)*$/;

            // Validaciones básicas
            if (!nombre_usuario || !correo_electronico || !contrasena || !numero_telefono) {
                errores.push("Los campos nombre_usuario, correo_electronico, numero_telefono y contrasena son obligatorios");
            } else if (nombre_usuario.length < 5 || nombre_usuario.length > 50) {
                errores.push("El nombre de usuario debe tener entre 5 y 50 caracteres");
            } else if (correo_electronico.length < 10 || correo_electronico.length > 100) {
                errores.push("El correo electrónico debe tener entre 10 y 100 caracteres");
            } else if (numero_telefono.length < 10 || numero_telefono.length > 13) {
                errores.push("El número de teléfono debe tener entre 10 y 13 caracteres");
            } else if (contrasena.length < 8 || contrasena.length > 100) {
                errores.push("La contraseña debe tener entre 8 y 100 caracteres");
            } else if (!emailRegex.test(correo_electronico)) { // Validación de formato de email.
                errores.push("El correo electrónico no tiene un formato válido");
            } else if (!telefonoRegex.test(numero_telefono)) { // Validación de formato de teléfono.
                errores.push("El teléfono debe contener solo números y entre 10 y 13 dígitos");
            } else if (!usernameRegex.test(nombre_usuario)) { // Validación de formato de nombre de usuario.
                errores.push("El nombre de usuario solo puede contener letras y espacios");
            } else if (fecha_nacimiento) {
                const fechaObj = new Date(fecha_nacimiento);
                if (isNaN(fechaObj.getTime())) {
                    errores.push("La fecha de nacimiento no es válida");
                } else {
                    const edad = new Date().getFullYear() - fechaObj.getFullYear();
                    if (edad < 18) errores.push("Debes ser mayor de 18 años");
                }
            }

            if (!acepta_aviso_privacidad || !acepta_terminos_condiciones) {
                errores.push("Debes aceptar el aviso de privacidad y los términos y condiciones");
            }

            if (errores.length > 0) {
                return res.status(400).json({ errors: errores });
            }

            // Normalizar datos
            const correo_normalizado = correo_electronico.toLowerCase().trim();
            const telefono_limpio = numero_telefono.replace(/\s/g, '');
            const nombre_limpio = nombre_usuario.trim();

            // Hash de contraseña
            let contrasena_hash: string;
            try {
                const saltRounds = process.env.NODE_ENV === 'production' ? 12 : 10;
                contrasena_hash = await bcrypt.hash(contrasena, saltRounds);
            } catch (hashError) {
                await logError(req, hashError, 'AuthController', 'register', 'usuario', 'lAcceso');
                return res.status(500).json({ message: "Error interno al procesar la contraseña" });
            }

            const defaultRole = parseInt(process.env.DEFAULT_ROLE_ID || '2');
            const rolFinal = id_rol_usuario || defaultRole;

            const { data, error } = await  supabase.schema('usuario')
            .rpc('registrar_usuario', {
                _nombre_usuario: nombre_limpio,
                _apellido_paterno: apellido_paterno || null,
                _apellido_materno: apellido_materno || null,
                _correo_electronico: correo_normalizado,
                _numero_telefono: telefono_limpio,
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
                    return res.status(409).json({ message: "El correo o teléfono ya está registrado" });
                }
                return res.status(500).json({ message: "Error al registrar el usuario" });
            }

            const nuevoUsuario = data;
            const userId = nuevoUsuario.id;

            // Obtener el rol real del usuario
            const { data: userWithRole, error: roleError } = await supabase
                .schema('usuario')
                .from('tUsuario')
                .select('id_rol_usuario')
                .eq('id_usuario', userId)
                .single();

            if (roleError) {
                await logError(req, roleError, 'AuthController', 'register', 'usuario', 'lAcceso', userId);
            }
            const id_rol = userWithRole?.id_rol_usuario || rolFinal;

            const { error: updateAccesoError } = await supabase
                .schema('usuario')
                .from('tAcceso')
                .update({ ultimo_acceso: new Date() })
                .eq('id_usuario', userId);

            if (updateAccesoError) {
                await logError(req, updateAccesoError, 'AuthController', 'register_update_acceso', 'usuario', 'lAcceso',userId);
            }

            // Preparar payload del token
            const tokenPayload: TokenPayload = {
                id_usuario: userId,
                nombre_usuario: nuevoUsuario.nombre_usuario,
                correo_electronico: nuevoUsuario.correo_electronico,
                id_rol_usuario: id_rol
            };

            // Generar tokens
            const accessToken = generateAccessToken(tokenPayload);
            const refreshToken = generateRefreshToken(tokenPayload);
            const refreshTokenHash = await hashRefreshToken(refreshToken);
            const expiresAt = getRefreshTokenExpiry();

            // Guardar sesión en tSesion
            const { error: sessionError } = await supabase
                .schema('usuario')
                .from('tSesion')
                .insert({
                    id_usuario: userId,
                    refresh_token_hash: refreshTokenHash,
                    ip_address: req.ip || req.socket.remoteAddress,
                    user_agent: req.headers['user-agent'],
                    expires_at: expiresAt,
                    revoked: false
                });

            if (sessionError) {
                await logError(req, sessionError, 'AuthController', 'register', 'usuario', 'lAcceso', userId);
                // Aunque falle la sesión, el usuario ya está creado.
                // Se responde error para que el cliente reintente (pero el usuario ya existe)
                return res.status(500).json({ message: "Usuario creado pero error al iniciar sesión automática" });
            }

            sendWelcomeEmail(correo_normalizado, nombre_limpio).catch(err => {
                console.error('Error al enviar correo de bienvenida:', err);
                logError(req, err, 'AuthController', 'sendWelcomeEmail', 'usuario', 'lAcceso', userId);
            });

            // Respuesta exitosa con tokens
            res.status(201).json({
                message: "Usuario registrado exitosamente",
                user: {
                    id: userId,
                    nombre_usuario: nuevoUsuario.nombre_usuario,
                    correo_electronico: nuevoUsuario.correo_electronico
                },
                tokens: {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    expires_in: process.env.JWT_ACCESS_EXPIRES_IN
                }
            });
        } catch (err: any) {
            await logError(req, err, 'AuthController', 'register', 'usuario', 'lAcceso');
            res.status(500).json({ error: "Error en el servidor" });
        }
    }

    public async login(req: Request, res: Response) {
        try {
            const { correo, contrasena } = req.body;

            // Validaciones básicas
            if (!correo || !contrasena) {
                return res.status(400).json({ message: "Correo y contraseña son obligatorios" });
            }

            // Buscar usuario por correo electrónico o nombre de usuario
            const { data: user, error: userError } = await supabase
                .schema('usuario')
                .from('tUsuario')
                .select('id_usuario, nombre_usuario, correo_electronico, contrasena_hash, id_rol_usuario')
                .eq('correo_electronico', correo)
                .maybeSingle();

            if (userError) {
                await logError(req, userError, 'AuthController', 'login', 'usuario', 'lAcceso');
                return res.status(500).json({ message: "Error al buscar usuario" });
            }

            // Usuario no existe
            if (!user) {
                await this.registrarIntentoFallido(null, req);
                return res.status(401).json({ message: "Credenciales inválidas" });
            }

            // Obtener información de acceso
            const { data: acceso, error: accesoError } = await supabase
                .schema('usuario')
                .from('tAcceso')
                .select('intentos_fallidos, bloqueado_hasta')
                .eq('id_usuario', user.id_usuario)
                .maybeSingle();

            if (accesoError) {
                await logError(req, accesoError, 'AuthController', 'login', 'usuario', 'lAcceso', user.id_usuario);
            }

            // Verificar bloqueo
            if (acceso?.bloqueado_hasta && new Date(acceso.bloqueado_hasta) > new Date()) {
                const minutosRestantes = Math.ceil((new Date(acceso.bloqueado_hasta).getTime() - Date.now()) / 60000);
                return res.status(423).json({
                    message: `Cuenta bloqueada. Intente nuevamente en ${minutosRestantes} minutos`
                });
            }

            // Verificar contraseña
            const passwordMatch = await bcrypt.compare(contrasena, user.contrasena_hash);
            if (!passwordMatch) {
                // Incrementar intentos fallidos
                await this.registrarIntentoFallido(user.id_usuario, req);
                return res.status(401).json({ message: "Credenciales inválidas" });
            }

            // Login exitoso: resetear intentos, actualizar último acceso
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

            // Obtener suscripción activa del usuario
            const { data: suscripcion, error: subError } = await supabase
                .schema('usuario')
                .from('tUsuarioSuscripcion')
                .select(`
                    id_suscripcion,
                    fecha_inicio,
                    fecha_fin,
                    estado,
                    id_tipo_suscripcion,
                    tTipoSuscripcion (
                        nombre,
                        descripcion,
                        duracion_dias,
                        precio,
                        moneda
                    )
                `)
                .eq('id_usuario', user.id_usuario)
                .or('estado.eq.activa,estado.eq.pendiente')
                .or('fecha_fin.is.null,fecha_fin.gt.now()')
                .maybeSingle();
            
            if (subError) {
                await logError(req, subError, 'AuthController', 'login_suscripcion', 'usuario', 'lAcceso', user.id_usuario);
                // No interrumpimos el login, solo omitimos la suscripción
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
                    vigente: suscripcion.fecha_fin ? new Date(suscripcion.fecha_fin) > new Date() : true
                };
            }

            // Preparar payload del token
            const tokenPayload: TokenPayload = {
                id_usuario: user.id_usuario,
                nombre_usuario: user.nombre_usuario,
                correo_electronico: user.correo_electronico,
                id_rol_usuario: user.id_rol_usuario
            };

            // Generar tokens
            const accessToken = generateAccessToken(tokenPayload);
            const refreshToken = generateRefreshToken(tokenPayload);
            const refreshTokenHash = await hashRefreshToken(refreshToken);
            const expiresAt = getRefreshTokenExpiry();

            // Guardar sesión en tSesion (opcionalmente podrías revocar sesiones anteriores)
            const realIp = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress;
            const { error: sessionError } = await supabase
                .schema('usuario')
                .from('tSesion')
                .insert({
                    id_usuario: user.id_usuario,
                    refresh_token_hash: refreshTokenHash,
                    ip_address: realIp,
                    user_agent: req.headers['user-agent'],
                    expires_at: expiresAt,
                    revoked: false
                });

            if (sessionError) {
                await logError(req, sessionError, 'AuthController', 'login', 'usuario', 'lAcceso', user.id_usuario);
                return res.status(500).json({ message: "Error al iniciar sesión" });
            }

            // Respuesta exitosa
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
                    refresh_token: refreshToken,
                    expires_in: process.env.JWT_ACCESS_EXPIRES_IN
                }
            });

        } catch (err: any) {
            await logError(req, err, 'AuthController', 'login', 'usuario', 'lAcceso');
            res.status(500).json({ error: "Error en el servidor" });
        }
    }

    // Método auxiliar para registrar intentos fallidos y posible bloqueo
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