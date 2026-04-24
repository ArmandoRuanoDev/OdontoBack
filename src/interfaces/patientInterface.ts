export interface CreatePatientRequest {
    nombre: string;
    telefono_principal: string;
    apellido_paterno?: string;
    apellido_materno?: string;
    fecha_nacimiento?: string; // ISO date
    sexo?: 'M' | 'F';
    correo_electronico?: string;
    telefono_secundario?: string;
    calle?: string;
    numero_exterior?: string;
    numero_interior?: string;
    colonia?: string;
    ciudad?: string;
    estado?: string;
    codigo_postal?: string;
    pais?: string;
    contacto_emergencia_nombre?: string;
    contacto_emergencia_parentesco?: string;
    contacto_emergencia_telefono?: string;
    ocupacion?: string;
    referido_por?: string;
}

export interface Patient extends CreatePatientRequest {
    id_paciente: number;
    id_doctor: number;
    created_at: string;
    updated_at: string | null;
    activo: boolean;
}