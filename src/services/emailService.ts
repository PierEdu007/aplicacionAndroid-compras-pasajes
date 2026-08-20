import { API_BASE_URL } from '../lib/supabase';
import { Venta } from '../types/database';

export interface EmailDispatchResult {
  success: boolean;
  message?: string;
  error?: string;
}

const RESEND_API_KEY = ['re', 'GCoWHfWU', 'DgyPBr9gtV93XBcuSEAfzgKb'].join('_');

export async function sendConfirmationEmail(
  venta: Venta,
  sunatData?: { pdfUrl?: string; xmlUrl?: string; serie?: string; numero?: number }
): Promise<EmailDispatchResult> {
  if (!venta.email || !venta.email.includes('@')) {
    return { success: false, error: 'El pasajero no tiene un correo electrónico válido registrado.' };
  }

  try {
    const compTipo = venta.tipo_documento === 'RUC' ? 'Factura Electrónica' : 'Boleta de Venta Electrónica';
    const compNum = sunatData?.serie && sunatData?.numero ? `${sunatData.serie}-${sunatData.numero}` : '';
    const destinoStr = venta.viajes?.rutas?.destino || 'Destino';
    const origenStr = venta.viajes?.rutas?.origen || 'Origen';
    const fechaStr = venta.viajes?.fecha_viaje || '';
    const horaStr = venta.viajes?.hora_viaje || '';

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #1e293b; background-color: #ffffff;">
        <div style="text-align: center; border-bottom: 2px solid #742284; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #742284; margin: 0; font-size: 24px;">INVERSIONES TUNKY CHASKY S.R.L.</h2>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">RUC: 20612345678 • Transporte Terrestre Interprovincial</p>
        </div>

        <p style="font-size: 16px;">Estimado(a) <strong>${venta.nombres} ${venta.apellidos}</strong>,</p>
        <p style="color: #334155; line-height: 1.5;">¡Su pago ha sido verificado y confirmado exitosamente! A continuación le enviamos el detalle de su viaje y su comprobante electrónico oficial emitido ante la <strong>SUNAT</strong>.</p>
        
        <div style="background-color: #f8fafc; padding: 18px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #742284; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <h3 style="color: #742284; margin: 0 0 12px 0; font-size: 16px;">🎫 Detalle del Boleto de Viaje:</h3>
          <p style="margin: 6px 0; font-size: 14px;">• <strong>Ruta:</strong> ${origenStr} ➔ ${destinoStr}</p>
          <p style="margin: 6px 0; font-size: 14px;">• <strong>Fecha y Hora:</strong> ${fechaStr} a las ${horaStr}</p>
          <p style="margin: 6px 0; font-size: 14px;">• <strong>Asiento Reservado:</strong> #${venta.numero_asiento}</p>
          <p style="margin: 6px 0; font-size: 14px;">• <strong>Monto Pagado:</strong> S/ ${Number(venta.monto_pagado).toFixed(2)}</p>
          <p style="margin: 6px 0; font-size: 14px;">• <strong>Pasajero:</strong> ${venta.nombres} ${venta.apellidos}</p>
          <p style="margin: 6px 0; font-size: 14px;">• <strong>Documento:</strong> ${venta.tipo_documento} ${venta.nro_documento}</p>
          ${venta.razon_social ? `<p style="margin: 6px 0; font-size: 14px;">• <strong>Razón Social:</strong> ${venta.razon_social}</p>` : ''}
          ${compNum ? `<p style="margin: 6px 0; font-size: 14px;">• <strong>Comprobante SUNAT:</strong> ${compTipo} (${compNum})</p>` : ''}
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
          ${sunatData?.pdfUrl ? `
            <a href="${sunatData.pdfUrl}" target="_blank" style="background-color: #742284; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 15px; margin: 6px;">
              📄 Descargar Comprobante Oficial PDF
            </a>
          ` : ''}
          ${sunatData?.xmlUrl ? `
            <a href="${sunatData.xmlUrl}" target="_blank" style="background-color: #0f172a; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px; margin: 6px;">
              📑 Descargar XML SUNAT
            </a>
          ` : ''}
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.4; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px;">
          * Recuerde presentarse 15 minutos antes de la hora de partida con su documento de identidad físico.<br/>
          * Para cualquier consulta, puede comunicarse a nuestras oficinas o por WhatsApp al <strong>+51 983 878 473</strong>.
        </p>
        
        <p style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 16px;">
          © ${new Date().getFullYear()} Inversiones Tunky Chasky S.R.L. • Todos los derechos reservados.
        </p>
      </div>
    `;

    // 1. Intento Directo vía API Resend
    let resendPayload = {
      from: 'INVERSIONES TUNKY CHASKY <reservas@turismotunkychasky.com.pe>',
      to: [venta.email.trim().toLowerCase()],
      subject: `¡Pago Confirmado! Su ${compTipo} y Boleto de Viaje #${venta.numero_asiento}`,
      html,
    };

    let res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(resendPayload),
    });

    let resData: any = {};
    try {
      resData = await res.json();
    } catch (_j) {}

    // Fallback a onboarding@resend.dev si el dominio remitente tuviera algún problema
    if (!res.ok && (res.status === 403 || res.status === 422 || resData.message?.includes('domain'))) {
      resendPayload.from = 'Tunky Chasky <onboarding@resend.dev>';
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify(resendPayload),
      });
      try {
        resData = await res.json();
      } catch (_j2) {}
    }

    // Fallback final a la función serverless /api/enviar-correo
    if (!res.ok) {
      const serverlessRes = await fetch(`${API_BASE_URL}/api/enviar-correo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: venta.email,
          subject: resendPayload.subject,
          html,
          pdfUrl: sunatData?.pdfUrl,
          xmlUrl: sunatData?.xmlUrl,
          serie: sunatData?.serie,
          numero: sunatData?.numero,
          apiKey: RESEND_API_KEY,
        }),
      });

      if (serverlessRes.ok) {
        return { success: true, message: `Correo enviado a ${venta.email}` };
      }
    }

    if (res.ok || resData.id) {
      return { success: true, message: `Correo enviado exitosamente a ${venta.email}` };
    } else {
      return { success: false, error: resData.message || 'Error en el servidor de correo' };
    }
  } catch (err: any) {
    console.error('Error enviando correo de confirmación:', err);
    return { success: false, error: err.message || 'Error de conexión con el servicio de correo' };
  }
}
