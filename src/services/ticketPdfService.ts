import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Venta } from '../types/database';

export async function generateAndShareTicket(venta: Venta): Promise<void> {
  const compTipo = venta.tipo_documento === 'RUC' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA';
  const compNum = venta.nro_comprobante || 'PROVISIONAL';
  const fecha = venta.viajes?.fecha_viaje || new Date().toLocaleDateString('es-PE');
  const hora = venta.viajes?.hora_viaje || '';
  const rutaOrigen = venta.viajes?.rutas?.origen || 'CUSCO';
  const rutaDestino = venta.viajes?.rutas?.destino || 'QUILLABAMBA';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: 'Courier New', Courier, monospace;
          width: 280px;
          margin: 0 auto;
          padding: 10px;
          color: #000;
          font-size: 12px;
        }
        .text-center { text-align: center; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; }
        .title { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
        .subtitle { font-size: 10px; }
        .badge { background: #000; color: #fff; padding: 2px 6px; font-size: 14px; font-weight: bold; }
        .terms { font-size: 8px; text-align: justify; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="text-center">
        <div class="title">INVERSIONES TUNKY CHASKY S.R.L.</div>
        <div class="subtitle">RUC: 20613271701</div>
        <div class="subtitle">Transporte Turístico e Interprovincial</div>
        <div class="subtitle">Cusco - Quillabamba - Hidroeléctrica</div>
      </div>

      <div class="divider"></div>

      <div class="text-center">
        <div class="bold" style="font-size: 13px;">BOLETO DE VIAJE</div>
        <div class="subtitle">${compTipo}: ${compNum}</div>
      </div>

      <div class="divider"></div>

      <div class="row">
        <span>PASAJERO:</span>
        <span class="bold">${venta.nombres} ${venta.apellidos}</span>
      </div>
      <div class="row">
        <span>${venta.tipo_documento}:</span>
        <span class="bold">${venta.nro_documento}</span>
      </div>
      <div class="row">
        <span>TELÉFONO:</span>
        <span>${venta.telefono}</span>
      </div>

      <div class="divider"></div>

      <div class="row">
        <span>RUTA:</span>
        <span class="bold">${rutaOrigen} ➔ ${rutaDestino}</span>
      </div>
      <div class="row">
        <span>TIPO DE VEHÍCULO:</span>
        <span class="bold" style="color: #0f4c81;">${(venta.culqi_charge_id?.includes('6P') || (venta.viajes as any)?.vehiculos?.total_asientos_pasajero === 6 || venta.numero_asiento > 5) ? 'CAMIONETA (6 PASAJEROS)' : 'AUTO (4 PASAJEROS)'}</span>
      </div>
      <div class="row">
        <span>FECHA / HORA:</span>
        <span class="bold">${fecha} ${hora}</span>
      </div>
      <div class="row" style="align-items: center; margin: 6px 0;">
        <span class="bold" style="font-size: 13px;">ASIENTO ASIGNADO:</span>
        <span class="badge"># ${venta.numero_asiento}</span>
      </div>

      <div class="divider"></div>

      <div class="row" style="font-size: 13px;">
        <span class="bold">TOTAL PAGADO:</span>
        <span class="bold">S/ ${Number(venta.monto_pagado).toFixed(2)}</span>
      </div>
      <div class="row">
        <span>MÉTODO DE PAGO:</span>
        <span class="bold">${venta.metodo_pago || 'YAPE'}</span>
      </div>

      <div class="divider"></div>

      <div class="terms">
        • Presentarse 15 minutos antes de la hora indicada.<br>
        • Prohibido transportar sustancias peligrosas o inflamables.<br>
        • Conserve su boleto para abordar la unidad.<br>
        • ¡Gracias por su preferencia!
      </div>
    </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html, width: 280, height: 500 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Boleto Asiento #${venta.numero_asiento} - ${venta.nombres}`,
        UTI: 'com.adobe.pdf',
      });
    }
  } catch (e) {
    console.error('Error generando ticket:', e);
  }
}
