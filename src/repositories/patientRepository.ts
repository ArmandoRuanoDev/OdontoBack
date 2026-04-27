import supabase from "../database";
import { CreatePatientRequest } from "../interfaces/patientInterface";

export class PatientRepository {

    async createPatient(data: any, id_doctor: number) {
        const { data: nuevoId, error } = await supabase
            .schema('clinica')
            .rpc('crear_paciente', {
                _id_doctor: id_doctor,
                ...data
            });

        return { nuevoId, error };
    }

    async getById(id_paciente: number, id_doctor: number) {
        return supabase
            .schema('clinica')
            .from('tPaciente')
            .select('*')
            .eq('id_paciente', id_paciente)
            .eq('id_doctor', id_doctor)
            .single();
    }

    async list(id_doctor: number, filters: any) {
        let query = supabase
            .schema('clinica')
            .from('tPaciente')
            .select('*', { count: 'exact' })
            .eq('id_doctor', id_doctor);

        return query;
    }
}