import { API_BASE_URL } from '../lib/supabase';
import { Venta } from '../types/database';

export interface EmailDispatchResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function sendConfirmationEmail(
  venta: Venta,
  sunatData?: { pdfUrl?: string; xmlUrl?: string; serie?: string; numero?: number }
): Promise<EmailDispatchResult> {
  try {
    const compTipo = venta.tipo_documento === 'RUC' ? 'Factura Electrónica' : 'Boleta Electrónica';
    const compNum = sunatData?.serie && sunatData?.numero ? `${sunatData.serie}-${sunatData.numero}` : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #1e293b;">
        <h2 style="color: #742284; margin-top: 0;">INVERSIONES TUNKY CHASKY S.R.L.</h2>
        <p>Estimado(a) <strong>${venta.nombres} ${venta.apellidos}</strong>,</p>
        <p>¡Su pago ha sido verificado y confirmado exitosamente desde nuestra aplicación oficial!</p>
        
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #742284;">
          <p style="margin: 4px 0;"><strong>Detalle del Pasaje:</strong></p>
          <p style="margin: 4px 0;">• <strong>Asiento Reservado:</strong> #${venta.numero_asiento}</p>
          <p style="margin: 4px 0;">• <strong>Monto Pagado:</strong> S/ ${Number(venta.monto_pagado).toFixed(2)}</p>
          <p style="margin: 4px 0;">• <strong>Documento:</strong> ${venta.tipo_documento} ${venta.nro_documento}</p>
          <p style="margin: 4px 0;">• <strong>Comprobante:</strong> ${compTipo} ${compNum}</p>
        </div>
        
        <p>Adjunto a este correo encontrará su <strong>Boleto de Viaje</strong> y su <strong>${compTipo} oficial</strong>.</p>
        
        ${sunatData?.pdfUrl ? `<p><a href="${sunatData.pdfUrl}" target="_blank" style="background-color: #742284; color: #ffffff; padding: 10px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">📄 Descargar Comprobante Oficial PDF</a></p>` : ''}
        
        <p style="margin-top: 24px; font-size: 0.9em; color: #64748b;">¡Gracias por viajar con Tunky Chasky!</p>
      </div>
    `;

    const res = await fetch(`${API_BASE_URL}/api/enviar-correo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: venta.email,
        subject: `¡Pago Confirmado! Su ${compTipo} y Boleto de Viaje #${venta.numero_asiento}`,
        html,
        pdfUrl: sunatData?.pdfUrl,
        xmlUrl: sunatData?.xmlUrl,
        serie: sunatData?.serie,
        numero: sunatData?.numero,
      }),
    });

    const resData = await res.json();

    if (res.ok) {
      return { success: true, message: `Correo enviado a ${venta.email}` };
    } else {
      return { success: false, error: resData.message || resData.error || 'Error al enviar correo' };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error de conexión con servicio de correo' };
  }
}
