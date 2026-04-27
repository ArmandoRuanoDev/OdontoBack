import { Request, Response } from "express";
import supabase from "../database";
import { logError } from "../util/logError";
import { CreatePatientRequest } from "../interfaces/patientInterface";

class PatientController {

    constructor() {
        this.create = this.create.bind(this);
        this.list = this.list.bind(this);
    }

    /**
     * POST /api/pat
     * Crea un nuevo paciente asociado al doctor autenticado.
     */
    public async create(req: Request, res: Response) {
        try {

            const user = (req as any).user;
            const id_doctor = user.id_usuario;

            const payload: CreatePatientRequest = req.body;

            // Normalización de datos importantes
            const nombre = payload.nombre?.trim();
            const telefono_principal = payload.telefono_principal?.replace(/\s/g, '');
            const correo = payload.correo_electronico?.trim().toLowerCase() || null;

            const errores = this.validarDatosPaciente(payload);
            if (errores.length > 0) {
                return res.status(400).json({ errors: errores });
            }

            const { data: nuevoId, error: rpcError } = await supabase
                .schema('clinica')
                .rpc('crear_paciente', {
                    _id_doctor: id_doctor,
                    _nombre: nombre,
                    _telefono_principal: telefono_principal,
                    _apellido_paterno: payload.apellido_paterno?.trim() || null,
                    _apellido_materno: payload.apellido_materno?.trim() || null,
                    _fecha_nacimiento: payload.fecha_nacimiento || null,
                    _sexo: payload.sexo || null,
                    _correo_electronico: correo,
                    _telefono_secundario: payload.telefono_secundario?.replace(/\s/g, '') || null,
                    _calle: payload.calle?.trim() || null,
                    _numero_exterior: payload.numero_exterior || null,
                    _numero_interior: payload.numero_interior || null,
                    _colonia: payload.colonia?.trim() || null,
                    _ciudad: payload.ciudad?.trim() || null,
                    _estado: payload.estado?.trim() || null,
                    _codigo_postal: payload.codigo_postal || null,
                    _pais: payload.pais || 'México',
                    _contacto_emergencia_nombre: payload.contacto_emergencia_nombre?.trim() || null,
                    _contacto_emergencia_parentesco: payload.contacto_emergencia_parentesco || null,
                    _contacto_emergencia_telefono: payload.contacto_emergencia_telefono?.replace(/\s/g, '') || null,
                    _ocupacion: payload.ocupacion?.trim() || null,
                    _referido_por: payload.referido_por?.trim() || null
                });

            if (rpcError) {
                await logError(req, rpcError, 'PatientController', 'create', 'clinica', 'lClinica', id_doctor);

                const msg = rpcError.message?.toLowerCase();

                if (msg?.includes('duplicate') || msg?.includes('unique')) {
                    return res.status(409).json({
                        message: "Ya existe un registro con ese correo para este doctor"
                    });
                }

                return res.status(500).json({
                    message: "Error al crear el paciente"
                });
            }

            const { data: paciente, error: fetchError } = await supabase
                .schema('clinica')
                .from('tPaciente')
                .select('*')
                .eq('id_paciente', nuevoId)
                .single();

            if (fetchError || !paciente) {
                await logError(req, fetchError || new Error('Paciente no encontrado'), 'PatientController', 'create', 'clinica', 'lClinica', id_doctor);

                return res.status(201).json({
                    message: "Paciente creado, pero no se pudo recuperar el detalle",
                    id_paciente: nuevoId
                });
            }

            return res.status(201).json({
                message: "Paciente creado exitosamente",
                paciente
            });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'create', 'clinica', 'lClinica');
            return res.status(500).json({ error: "Error en el servidor" });
        }
    }

    /**
    * GET /api/pat
    * Lista pacientes del doctor autenticado con paginación y búsqueda.
    */
    public async list(req: Request, res: Response) {
        try {

            const user = (req as any).user;
            const id_doctor = user.id_usuario;

            const page = Math.max(parseInt(req.query.page as string) || 1, 1);
            const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
            const search = ((req.query.search as string) || '').trim();
            const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

            const allowedSortFields = ['nombre', 'apellido_paterno', 'created_at', 'fecha_nacimiento'];
            const sortBy = allowedSortFields.includes(req.query.sortBy as string)
                ? (req.query.sortBy as string)
                : 'created_at';

            const offset = (page - 1) * limit;

            let query = supabase
                .schema('clinica')
                .from('tPaciente')
                .select('*', { count: 'exact' })
                .eq('id_doctor', id_doctor);

            const activo = req.query.activo;

            if (activo !== undefined) {
                query = query.eq('activo', activo === 'true');
            }

            if (search) {
                const term = `%${search}%`;

                query = query.or(
                    `nombre.ilike.${term},apellido_paterno.ilike.${term},apellido_materno.ilike.${term},telefono_principal.ilike.${term},correo_electronico.ilike.${term}`
                );
            }

            const { data, error, count } = await query
                .order(sortBy, { ascending: sortOrder === 'asc' })
                .range(offset, offset + limit - 1);

            if (error) {
                await logError(req, error, 'PatientController', 'list', 'clinica', 'lClinica', id_doctor);
                return res.status(500).json({ message: "Error al obtener pacientes" });
            }

            const total = count || 0;

            return res.status(200).json({
                data: data || [],
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            });
        } catch (err: any) {
            await logError(req, err, 'PatientController', 'list', 'clinica', 'lClinica');
            return res.status(500).json({ error: "Error en el servidor" });
        }
    }

    /**
     * Valida los campos obligatorios y formatos básicos.
     * Retorna array de mensajes de error.
     */
    private validarDatosPaciente(data: CreatePatientRequest): string[] {
        const errores: string[] = [];

        const nombreRegex = /^[\p{L}]+(?:[ '\-][\p{L}]+)*$/u;
        const telefonoRegex = /^\+?[0-9]{10,15}$/;
        const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;

        // Normalización segura
        const nombreRaw = data.nombre ?? '';
        const nombre = nombreRaw.trim().replace(/\s+/g, ' ');
        const telefono = (data.telefono_principal ?? '').trim().replace(/\s/g, '');
        const telefonoEmergencia = (data.contacto_emergencia_telefono ?? '').trim().replace(/\s/g, '');
        const correo = data.correo_electronico?.trim().toLowerCase();

        if (!nombre) {
            errores.push("El nombre es obligatorio");
        } else {
            if (nombre.length < 2 || nombre.length > 50) {
                errores.push("El nombre debe tener entre 2 y 50 caracteres");
            }
            if (!nombreRegex.test(nombre)) {
                errores.push("El nombre solo puede contener letras, espacios, apóstrofes o guiones");
            }
        }
        
        if (!telefono) {
            errores.push("El teléfono es obligatorio");
        } else if (!telefonoRegex.test(telefono)) {
            errores.push("El teléfono debe tener entre 10 y 15 dígitos (puede incluir '+')");
        }

        if (correo && !emailRegex.test(correo)) {
            errores.push("El correo electrónico no tiene un formato válido");
        }
        
        if (data.fecha_nacimiento) {
            const fecha = new Date(data.fecha_nacimiento);

            if (isNaN(fecha.getTime())) {
                errores.push("La fecha de nacimiento no es válida");
            } else if (fecha > new Date()) {
                errores.push("La fecha de nacimiento no puede ser futura");
            }
        }
        
        if (data.sexo && !['M', 'F', 'O'].includes(data.sexo)) {
            errores.push("El sexo debe ser 'M', 'F' o 'O'");
        }
        
        if (telefonoEmergencia && !telefonoRegex.test(telefonoEmergencia)) {
            errores.push("El teléfono de emergencia debe tener entre 10 y 15 dígitos (puede incluir '+')");
        } else if (telefono && telefonoEmergencia && telefono === telefonoEmergencia) {
            errores.push("El teléfono de emergencia no puede ser igual al del paciente")
        }

        return errores;
    }
}

export const patientController = new PatientController();