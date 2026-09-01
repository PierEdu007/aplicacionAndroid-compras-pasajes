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
  descripcionOpcional?: string;
  dniPasajero?: string;
  origen: string;
  destino: string;
  asiento: number;
  monto: number;
  fechaViaje: string;
  horaViaje: string;
  esViajeEspecial?: boolean;
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
        apiUrl: parsed.apiUrl || '',
        apiToken: parsed.apiToken || '',
        serieBoleta: parsed.serieBoleta || 'BBB1',
        serieFactura: parsed.serieFactura || 'FFF1',
        tipoIgv: parsed.tipoIgv ?? 8,
      };
    }
  } catch (_e) {}

  return {
    enabled: true, // Habilitado por defecto para usar backend de producción
    apiUrl: '',
    apiToken: '',
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

  if (config.enabled === false) {
    return {
      success: false,
      error: 'La facturación SUNAT está deshabilitada en la configuración.',
    };
  }

  const isFactura = data.tipoDocumento === 'RUC';
  const tipoComprobante = isFactura ? 1 : 2;
  const serie = isFactura ? config.serieFactura || 'FFF1' : config.serieBoleta || 'BBB1';

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

  const todayStr = getPeruTodayString(); // YYYY-MM-DD
  const [yyyy, mm, dd] = todayStr.split('-');
  const fechaEmisionNubeFact = `${dd}-${mm}-${yyyy}`;

  // Si descripcionOpcional tiene más de 30 caracteres, se considera un detalle editado manualmente
  const usarDescripcionManual = data.descripcionOpcional && data.descripcionOpcional.trim().length > 30;
  const itemDescripcion = usarDescripcionManual
    ? data.descripcionOpcional!.toUpperCase().trim()
    : data.esViajeEspecial
      ? `SERVICIO DE TRANSPORTE ${data.origen} ${data.destino}`.toUpperCase().trim()
      : `SERVICIO DE TRANSPORTE ${data.origen} - ${data.destino} PASAJERO: ${data.nombres} ${data.apellidos} ${data.tipoDocumento}.${data.nroDocumento} ASIENTO #${data.asiento}${data.dniPasajero ? ' - DNI ' + data.dniPasajero : ''}`.toUpperCase();

  const itemCodigo = data.esViajeEspecial ? 'SERV-ESP' : `PAS-${data.asiento}`;

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
    fecha_de_emision: fechaEmisionNubeFact,
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
        codigo: itemCodigo,
        descripcion: itemDescripcion,
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

      // Auto-reintento con serie alternativa si la serie no está autorizada
      if (result.codigo === 21 || errMsg.toLowerCase().includes('serie') || errMsg.toLowerCase().includes('autorizada')) {
        const altSerie = isFactura 
          ? (serie === 'FFF1' ? 'F001' : 'FFF1')
          : (serie === 'BBB1' ? 'B001' : 'BBB1');
        try {
          const retryRes = await fetch(`${API_BASE_URL}/api/emitir-comprobante`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiUrl: config.apiUrl,
              apiToken: config.apiToken,
              payload: { ...payload, serie: altSerie },
            }),
          });
          if (retryRes.ok) {
            const retryResult = await retryRes.json();
            if (!retryResult.errors && retryResult.enlace_del_pdf) {
              return {
                success: true,
                serie: retryResult.serie,
                numero: retryResult.numero,
                pdfUrl: retryResult.enlace_del_pdf,
                xmlUrl: retryResult.enlace_del_xml,
                cdrUrl: retryResult.enlace_del_cdr,
                qrCode: retryResult.cadena_para_codigo_qr,
                sunatMessage: retryResult.sunat_description || 'Comprobante emitido correctamente ante SUNAT',
              };
            }
          }
        } catch (_retryErr) {}
      }

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

/**
 * Anular Comprobante Electrónico (Comunicación de Baja ante SUNAT)
 */
export async function anularComprobanteSunat(
  tipoComprobante: string,
  serie: string,
  numero: number,
  motivo?: string,
  customConfig?: SunatConfig
): Promise<SunatResponse> {
  const config = customConfig || (await getSunatConfig());

  if (config.enabled === false) {
    return {
      success: false,
      error: 'La facturación SUNAT está deshabilitada.',
    };
  }

  const isFactura = tipoComprobante === 'FACTURA' || tipoComprobante === 'RUC' || serie.startsWith('F');
  const tipoDocSunat = isFactura ? 1 : 2;

  const payload = {
    operacion: 'anular_comprobante',
    tipo_de_comprobante: tipoDocSunat,
    serie: serie,
    numero: numero,
    motivo: motivo || 'Anulación por error en emisión de viaje especial',
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
      const errMsg = typeof result.errors === 'string' ? result.errors : (result.message || '');
      
      // Reintento con generar_anulacion si anular_comprobante no es reconocido
      if (errMsg.toLowerCase().includes('operacion') || errMsg.toLowerCase().includes('operación')) {
        try {
          const retryRes = await fetch(`${API_BASE_URL}/api/emitir-comprobante`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiUrl: config.apiUrl,
              apiToken: config.apiToken,
              payload: { ...payload, operacion: 'generar_anulacion' },
            }),
          });
          if (retryRes.ok) {
            const retryResult = await retryRes.json();
            if (!retryResult.errors) {
              return {
                success: true,
                serie: retryResult.serie || serie,
                numero: retryResult.numero || numero,
                pdfUrl: retryResult.enlace_del_pdf,
                xmlUrl: retryResult.enlace_del_xml,
                cdrUrl: retryResult.enlace_del_cdr,
                sunatMessage: retryResult.sunat_description || 'Comprobante dado de baja exitosamente ante SUNAT',
              };
            }
          }
        } catch (_retryErr) {}
      }

      return {
        success: false,
        error: errMsg || 'Error al anular comprobante en NubeFact/SUNAT',
      };
    }

    return {
      success: true,
      serie: result.serie || serie,
      numero: result.numero || numero,
      pdfUrl: result.enlace_del_pdf,
      xmlUrl: result.enlace_del_xml,
      cdrUrl: result.enlace_del_cdr,
      sunatMessage: result.sunat_description || 'Comprobante dado de baja exitosamente ante SUNAT',
    };
  } catch (err: any) {
    console.error('Error al anular en SUNAT:', err);
    return {
      success: false,
      error: err.message || 'Error de conexión al anular con SUNAT',
    };
  }
}

