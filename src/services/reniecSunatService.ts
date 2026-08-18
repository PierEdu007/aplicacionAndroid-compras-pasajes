import { API_BASE_URL } from '../lib/supabase';

export interface DniResult {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  tipoDocumento: string;
  numeroDocumento: string;
}

export interface RucResult {
  razonSocial: string;
  direccion: string;
  estado: string;
  condicion: string;
  ruc: string;
}

export async function lookupDni(dni: string): Promise<DniResult | null> {
  const cleanDni = dni.trim().replace(/\D/g, '');
  if (cleanDni.length !== 8) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/dni?numero=${cleanDni}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (e) {
    console.warn('Error lookup DNI:', e);
    return null;
  }
}

export async function lookupRuc(ruc: string): Promise<RucResult | null> {
  const cleanRuc = ruc.trim().replace(/\D/g, '');
  if (cleanRuc.length !== 11) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/ruc?numero=${cleanRuc}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      razonSocial: data.nombre || data.razonSocial || '',
      direccion: data.direccion || 'CUSCO',
      estado: data.estado || 'ACTIVO',
      condicion: data.condicion || 'HABIDO',
      ruc: cleanRuc,
    };
  } catch (e) {
    console.warn('Error lookup RUC:', e);
    return null;
  }
}
