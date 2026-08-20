import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../lib/supabase';
import { getPeruTodayString } from '../utils/dateHelper';

export interface SunatConfig {
  enabled: boolean;
  apiUrl: string;
  apiToken: string;
  serieBoleta: string;
  serieFactura: string;
  tipoIgv: number;
}

export interface SunatVentaData {
  ventaId: string;
  tipoDocumento: 'DNI' | 'RUC' | 'CE' | 'PASAPORTE';
  nroDocumento: string;
  nombres: string;
  apellidos: string;
  email?: string;
  razonSocial?: string;
  direccionFiscal?: string;
  origen: string;
  destino: string;
  asiento: number;
  monto: number;
  fechaViaje: string;
  horaViaje: string;
}

export interface SunatResponse {
  success: boolean;
  serie?: string;
  numero?: number;
  pdfUrl?: string;
  xmlUrl?: string;
  cdrUrl?: string;
  qrCode?: string;
  sunatMessage?: string;
  error?: string;
}

const DEFAULT_CONFIG_KEY = 'sunat_pse_config_mobile';

export async function getSunatConfig(): Promise<SunatConfig> {
  try {
    const saved = await AsyncStorage.getItem(DEFAULT_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        enabled: parsed.enabled ?? true,
        apiUrl: parsed.apiUrl || 'https://api.nubefact.com/api/v1/ad363ac5-880b-4f3f-be7a-247d2908a9d6',
        apiToken: parsed.apiToken || '3c4fcc1af04b48b4b3fe291e485c1fa061857d24cc8143ce9d73f312b4836cbc',
        serieBoleta: parsed.serieBoleta || 'BBB1',
        serieFactura: parsed.serieFactura || 'FFF1',
        tipoIgv: parsed.tipoIgv ?? 8,
      };
    }
  } catch (_e) {}

  return {
    enabled: true,
    apiUrl: 'https://api.nubefact.com/api/v1/ad363ac5-880b-4f3f-be7a-247d2908a9d6',
    apiToken: '3c4fcc1af04b48b4b3fe291e485c1fa061857d24cc8143ce9d73f312b4836cbc',
    serieBoleta: 'BBB1',
    serieFactura: 'FFF1',
    tipoIgv: 8, // Exonerado
  };
}

export async function saveSunatConfig(config: SunatConfig): Promise<void> {
  await AsyncStorage.setItem(DEFAULT_CONFIG_KEY, JSON.stringify(config));
}

export async function emitirComprobanteSunat(
  data: SunatVentaData,
  customConfig?: SunatConfig
): Promise<SunatResponse> {
  const config = customConfig || (await getSunatConfig());

  if (!config.enabled || !config.apiUrl || !config.apiToken) {
    return {
      success: false,
      error: 'La facturación SUNAT no está habilitada o faltan credenciales.',
    };
  }

  const isFactura = data.tipoDocumento === 'RUC';
  const tipoComprobante = isFactura ? 1 : 2;
  let serie = isFactura ? config.serieFactura || 'FFF1' : config.serieBoleta || 'BBB1';
  if (serie === 'B001') serie = 'BBB1';
  if (serie === 'F001') serie = 'FFF1';

  let docTipoSunat = 1;
  if (data.tipoDocumento === 'RUC') docTipoSunat = 6;
  else if (data.tipoDocumento === 'CE') docTipoSunat = 4;
  else if (data.tipoDocumento === 'PASAPORTE') docTipoSunat = 7;

  const clienteNombre =
    isFactura && data.razonSocial
      ? data.razonSocial
      : `${data.nombres} ${data.apellidos}`.trim();

  const codigoUnico = data.ventaId
    ? `${data.ventaId.slice(0, 8)}-${serie}-${Date.now()}`
    : `VENTA-${serie}-${Date.now()}`;

  const payload = {
    operacion: 'generar_comprobante',
    tipo_de_comprobante: tipoComprobante,
    serie: serie,
    codigo_unico: codigoUnico,
    sunat_transaction: 1,
    cliente_tipo_de_documento: docTipoSunat,
    cliente_numero_de_documento: data.nroDocumento,
    cliente_denominacion: clienteNombre,
    cliente_direccion: data.direccionFiscal || 'CUSCO',
    cliente_email: data.email || 'reservas@turismotunkychasky.com.pe',
    fecha_de_emision: getPeruTodayString(),
    moneda: 1,
    porcentaje_de_igv: config.tipoIgv === 1 ? 18.0 : 0.0,
    total_igv: 0.0,
    total_gravada: config.tipoIgv === 1 ? Number((data.monto / 1.18).toFixed(2)) : 0.0,
    total_exonerada: config.tipoIgv === 8 ? Number(data.monto.toFixed(2)) : 0.0,
    total_inafecta: 0.0,
    total: Number(data.monto.toFixed(2)),
    enviar_auto_al_cliente: false,
    items: [
      {
        unidad_de_medida: 'ZZ',
        codigo: `PAS-${data.asiento}`,
        descripcion: `Pasaje Terrestre ${data.origen} -> ${data.destino} (Asiento #${data.asiento} - ${data.fechaViaje} ${data.horaViaje})`,
        cantidad: 1,
        valor_unitario: config.tipoIgv === 1 ? Number((data.monto / 1.18).toFixed(2)) : Number(data.monto.toFixed(2)),
        precio_unitario: Number(data.monto.toFixed(2)),
        subtotal: Number(data.monto.toFixed(2)),
        tipo_de_igv: config.tipoIgv,
        igv: config.tipoIgv === 1 ? Number((data.monto - data.monto / 1.18).toFixed(2)) : 0.0,
        total: Number(data.monto.toFixed(2)),
      },
    ],
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/emitir-comprobante`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiUrl: config.apiUrl,
        apiToken: config.apiToken,
        payload,
      }),
    });

    const result = await res.json();

    if (!res.ok || result.errors) {
      const errMsg = typeof result.errors === 'string' ? result.errors : result.message || '';
      return {
        success: false,
        error: errMsg || 'Error al emitir comprobante en NubeFact/SUNAT',
      };
    }

    return {
      success: true,
      serie: result.serie,
      numero: result.numero,
      pdfUrl: result.enlace_del_pdf,
      xmlUrl: result.enlace_del_xml,
      cdrUrl: result.enlace_del_cdr,
      qrCode: result.cadena_para_codigo_qr,
      sunatMessage: result.sunat_description || 'Comprobante emitido correctamente ante SUNAT',
    };
  } catch (err: any) {
    console.error('Error en emisión SUNAT:', err);
    return {
      success: false,
      error: err.message || 'Error de conexión con el servicio de facturación',
    };
  }
}
