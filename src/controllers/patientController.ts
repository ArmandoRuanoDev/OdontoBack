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
            // Obtener el id del doctor desde el token
            const user = (req as any).user;
            const id_doctor = user.id_usuario;

            const payload: CreatePatientRequest = req.body;
            const errores = this.validarDatosPaciente(payload);
            if (errores.length > 0) {
                return res.status(400).json({ errors: errores });
            }

            // Normalizar algunos campos
            const nombre = payload.nombre.trim();
            const telefono_principal = payload.telefono_principal.replace(/\s/g, '');
            const correo = payload.correo_electronico?.toLowerCase().trim() || null;

            // Llamar la función para crear al paciente
            const { data: nuevoId, error: rpcError } = await supabase
                .schema('clinica')
                .rpc('crear_paciente', {
                    _id_doctor: id_doctor,
                    _nombre: nombre,
                    _telefono_principal: telefono_principal,
                    _apellido_paterno: payload.apellido_paterno || null,
                    _apellido_materno: payload.apellido_materno || null,
                    _fecha_nacimiento: payload.fecha_nacimiento || null,
                    _sexo: payload.sexo || null,
                    _correo_electronico: correo,
                    _telefono_secundario: payload.telefono_secundario || null,
                    _calle: payload.calle || null,
                    _numero_exterior: payload.numero_exterior || null,
                    _numero_interior: payload.numero_interior || null,
                    _colonia: payload.colonia || null,
                    _ciudad: payload.ciudad || null,
                    _estado: payload.estado || null,
                    _codigo_postal: payload.codigo_postal || null,
                    _pais: payload.pais || 'México',
                    _contacto_emergencia_nombre: payload.contacto_emergencia_nombre || null,
                    _contacto_emergencia_parentesco: payload.contacto_emergencia_parentesco || null,
                    _contacto_emergencia_telefono: payload.contacto_emergencia_telefono || null,
                    _ocupacion: payload.ocupacion || null,
                    _referido_por: payload.referido_por || null
                });

            if (rpcError) {
                await logError(req, rpcError, 'PatientController', 'create', 'clinica', 'lClinica', id_doctor);
                if (rpcError.message?.includes('duplicate key') || rpcError.message?.includes('unique constraint')) {
                    return res.status(409).json({ message: "El correo electrónico ya está registrado para este doctor" });
                }
                return res.status(500).json({ message: "Error al crear el paciente" });
            }

            // Obtener el paciente recién creado para devolverlo completo
            const { data: paciente, error: fetchError } = await supabase
                .schema('clinica')
                .from('tPaciente')
                .select('*')
                .eq('id_paciente', nuevoId)
                .single();

            if (fetchError || !paciente) {
                await logError(req, fetchError || new Error('Paciente no encontrado después de crear'), 'PatientController', 'create', 'clinica', 'lClinica', id_doctor);
                // Aún así devolvemos el ID
                return res.status(201).json({
                    message: "Paciente creado, pero hubo un error al recuperar los detalles",
                    id_paciente: nuevoId
                });
            }

            res.status(201).json({
                message: "Paciente creado exitosamente",
                paciente
            });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'create', 'clinica', 'lClinica');
            res.status(500).json({ error: "Error en el servidor" });
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

            // Parámetros de consulta
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const search = (req.query.search as string) || '';
            const sortBy = (req.query.sortBy as string) || 'created_at';
            const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === 'asc' ? 'asc' : 'desc';
            const activo = req.query.activo !== undefined ? req.query.activo === 'true' : undefined;

            // Validar page y limit
            const validPage = page > 0 ? page : 1;
            const validLimit = limit > 0 && limit <= 100 ? limit : 20;
            const offset = (validPage - 1) * validLimit;

            // Construir consulta base
            let query = supabase
                .schema('clinica')
                .from('tPaciente')
                .select('*', { count: 'exact' })
                .eq('id_doctor', id_doctor);

            // Filtro por activo (si se especifica)
            if (activo !== undefined) {
                query = query.eq('activo', activo);
            }

            // Búsqueda por texto (nombre, apellidos, teléfono o correo)
            if (search.trim()) {
                const searchTerm = `%${search.trim()}%`;
                query = query.or(
                    `nombre.ilike.${searchTerm},` +
                    `apellido_paterno.ilike.${searchTerm},` +
                    `apellido_materno.ilike.${searchTerm},` +
                    `telefono_principal.ilike.${searchTerm},` +
                    `correo_electronico.ilike.${searchTerm}`
                );
            }

            // Ordenamiento (validar campos permitidos para evitar inyección SQL)
            const allowedSortFields = ['nombre', 'apellido_paterno', 'created_at', 'fecha_nacimiento'];
            const actualSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';

            query = query
                .order(actualSortBy, { ascending: sortOrder === 'asc' })
                .range(offset, offset + validLimit - 1);

            const { data: pacientes, error, count } = await query;

            if (error) {
                await logError(req, error, 'PatientController', 'list', 'clinica', 'lClinica', id_doctor);
                return res.status(500).json({ message: "Error al obtener la lista de pacientes" });
            }

            const total = count || 0;
            const totalPages = Math.ceil(total / validLimit);

            res.status(200).json({
                data: pacientes || [],
                pagination: {
                    page: validPage,
                    limit: validLimit,
                    total,
                    totalPages,
                    hasNext: validPage < totalPages,
                    hasPrev: validPage > 1
                }
            });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'list', 'clinica', 'lClinica');
            res.status(500).json({ error: "Error en el servidor" });
        }
    }

    /**
     * Valida los campos obligatorios y formatos básicos.
     * Retorna array de mensajes de error.
     */
    private validarDatosPaciente(data: CreatePatientRequest): string[] {
        const errores: string[] = [];

        if (!data.nombre || data.nombre.trim().length < 2) {
            errores.push("El nombre es obligatorio y debe tener al menos 2 caracteres");
        }
        if (!data.telefono_principal || !/^\+?[0-9]{10,13}$/.test(data.telefono_principal.replace(/\s/g, ''))) {
            errores.push("El teléfono principal debe tener entre 10 y 13 dígitos numéricos");
        }
        if (data.correo_electronico) {
            const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
            if (!emailRegex.test(data.correo_electronico)) {
                errores.push("El correo electrónico no tiene un formato válido");
            }
        }
        if (data.fecha_nacimiento) {
            const fecha = new Date(data.fecha_nacimiento);
            if (isNaN(fecha.getTime())) {
                errores.push("La fecha de nacimiento no es válida");
            } else if (fecha > new Date()) {
                errores.push("La fecha de nacimiento no puede ser futura");
            }
        }
        if (data.sexo && !['M', 'F'].includes(data.sexo)) {
            errores.push("El sexo debe ser 'M' o 'F'");
        }
        // Validar teléfono de emergencia si se proporciona
        if (data.contacto_emergencia_telefono && !/^\+?[0-9]{10,13}$/.test(data.contacto_emergencia_telefono.replace(/\s/g, ''))) {
            errores.push("El teléfono de emergencia debe tener entre 10 y 13 dígitos");
        }

        return errores;
    }
}

export const patientController = new PatientController();