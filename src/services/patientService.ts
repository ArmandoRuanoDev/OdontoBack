import { PatientRepository } from "../repositories/patientRepository";
import { CreatePatientRequest } from "../interfaces/patientInterface";

export class PatientService {

    constructor(private repo = new PatientRepository()) {}

    async createPatient(payload: CreatePatientRequest, id_doctor: number) {

        const nombre = payload.nombre.trim();
        const telefono = payload.telefono_principal.replace(/\s/g, '');

        const data = {
            _nombre: nombre,
            _telefono_principal: telefono,
            _apellido_paterno: payload.apellido_paterno || null,
            _apellido_materno: payload.apellido_materno || null,
            _fecha_nacimiento: payload.fecha_nacimiento || null,
            _sexo: payload.sexo || null,
            _correo_electronico: payload.correo_electronico?.toLowerCase() || null,
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
        };

        const { nuevoId, error } = await this.repo.createPatient(data, id_doctor);

        if (error) {
            throw error;
        }

        const paciente = await this.repo.getById(nuevoId, id_doctor);

        return paciente.data;
    }
}