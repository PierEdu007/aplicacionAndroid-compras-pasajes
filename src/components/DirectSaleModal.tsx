import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { THEME } from '../constants/theme';
import { Viaje, TipoDocumento } from '../types/database';
import { supabase, API_BASE_URL } from '../lib/supabase';
import { lookupDni, lookupRuc } from '../services/reniecSunatService';
import { emitirComprobanteSunat } from '../services/sunatService';
import { sendConfirmationEmail } from '../services/emailService';
import { generateAndShareTicket } from '../services/ticketPdfService';
import { X, Search, CheckCircle, CreditCard, Banknote, QrCode } from 'lucide-react-native';

interface DirectSaleModalProps {
  visible: boolean;
  onClose: () => void;
  onSaleComplete: () => void;
}

export const DirectSaleModal: React.FC<DirectSaleModalProps> = ({
  visible,
  onClose,
  onSaleComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [selectedViajeId, setSelectedViajeId] = useState('');
  const [availableSeats, setAvailableSeats] = useState<number[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);

  // Passenger form
  const [tipoDoc, setTipoDoc] = useState<TipoDocumento>('DNI');
  const [nroDoc, setNroDoc] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [direccionFiscal, setDireccionFiscal] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [metodoPago, setMetodoPago] = useState<'EFECTIVO' | 'YAPE' | 'TARJETA'>('EFECTIVO');
  const [codigoOpYape, setCodigoOpYape] = useState('');
  const [lookingUpDoc, setLookingUpDoc] = useState(false);

  useEffect(() => {
    if (visible) {
      loadActiveTrips();
    }
  }, [visible]);

  useEffect(() => {
    if (selectedViajeId) {
      loadAvailableSeats(selectedViajeId);
    } else {
      setAvailableSeats([]);
      setSelectedSeat(null);
    }
  }, [selectedViajeId]);

  const loadActiveTrips = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('viajes')
        .select(`
          id,
          fecha_viaje,
          hora_viaje,
          precio_base,
          rutas (origen, destino),
          vehiculos (nombre_display, total_asientos_pasajero)
        `)
        .eq('estado', 'ACTIVO')
        .gte('fecha_viaje', today)
        .order('fecha_viaje', { ascending: true })
        .order('hora_viaje', { ascending: true });

      if (data && data.length > 0) {
        setViajes(data as any);
        setSelectedViajeId(data[0].id);
      }
    } catch (e) {
      console.error('Error cargando viajes:', e);
    }
  };

  const loadAvailableSeats = async (viajeId: string) => {
    try {
      const viaje = viajes.find((v) => v.id === viajeId);
      const totalSeats = viaje?.vehiculos?.total_asientos_pasajero || 4;

      const { data: ventas } = await supabase
        .from('ventas')
        .select('numero_asiento, culqi_charge_id')
        .eq('viaje_id', viajeId);

      const soldSeats = new Set(
        ventas?.filter((v) => !v.culqi_charge_id?.startsWith('RECHAZADO_')).map((v) => v.numero_asiento) || []
      );

      const free: number[] = [];
      for (let i = 1; i <= totalSeats; i++) {
        if (!soldSeats.has(i)) {
          free.push(i);
        }
      }

      setAvailableSeats(free);
      if (free.length > 0) {
        setSelectedSeat(free[0]);
      } else {
        setSelectedSeat(null);
      }
    } catch (e) {
      console.error('Error cargando asientos:', e);
    }
  };

  const handleLookupDoc = async () => {
    if (tipoDoc === 'DNI' && nroDoc.length === 8) {
      setLookingUpDoc(true);
      const res = await lookupDni(nroDoc);
      setLookingUpDoc(false);
      if (res && res.nombres) {
        setNombres(res.nombres);
        setApellidos(`${res.apellidoPaterno} ${res.apellidoMaterno}`.trim());
      } else {
        Alert.alert('Aviso', 'DNI no encontrado en RENIEC. Ingrese los nombres manualmente.');
      }
    } else if (tipoDoc === 'RUC' && nroDoc.length === 11) {
      setLookingUpDoc(true);
      const res = await lookupRuc(nroDoc);
      setLookingUpDoc(false);
      if (res && res.razonSocial) {
        setRazonSocial(res.razonSocial);
        setDireccionFiscal(res.direccion || 'CUSCO');
      } else {
        Alert.alert('Aviso', 'RUC no encontrado en SUNAT. Ingrese los datos manualmente.');
      }
    }
  };

  const handleProcessSale = async () => {
    if (!selectedViajeId || !selectedSeat) {
      Alert.alert('Error', 'Selecciona un viaje y un asiento disponible.');
      return;
    }

    if (tipoDoc === 'RUC' && (!nroDoc || !razonSocial)) {
      Alert.alert('Error', 'Ingresa el RUC y la Razón Social.');
      return;
    }

    if (tipoDoc !== 'RUC' && (!nroDoc || !nombres || !apellidos)) {
      Alert.alert('Error', 'Ingresa el N° de documento, nombres y apellidos.');
      return;
    }

    if (!telefono) {
      Alert.alert('Error', 'Ingresa un número de celular de contacto.');
      return;
    }

    const selectedTrip = viajes.find((v) => v.id === selectedViajeId);
    if (!selectedTrip) return;

    setLoading(true);

    try {
      const chargeId =
        metodoPago === 'YAPE'
          ? `YAPE-${codigoOpYape || Date.now()}`
          : `PRESENCIAL-${metodoPago}-${Date.now()}`;

      // 1. Registrar venta en Supabase
      const { data: ventaData, error: vErr } = await supabase
        .from('ventas')
        .insert({
          viaje_id: selectedViajeId,
          numero_asiento: selectedSeat,
          tipo_documento: tipoDoc,
          nro_documento: nroDoc.trim(),
          nombres: tipoDoc === 'RUC' ? razonSocial : nombres.trim(),
          apellidos: tipoDoc === 'RUC' ? '' : apellidos.trim(),
          email: email.trim() || 'reservas@turismotunkychasky.com.pe',
          telefono: telefono.trim(),
          monto_pagado: selectedTrip.precio_base,
          culqi_charge_id: chargeId,
          metodo_pago: metodoPago,
          razon_social: razonSocial,
          direccion_fiscal: direccionFiscal,
          estado: 'CONFIRMADO',
          comprobante_emitido: true,
        })
        .select()
        .single();

      if (vErr) throw vErr;

      // 2. Bloquear permanentemente el asiento
      await supabase
        .from('asientos_bloqueos')
        .delete()
        .eq('viaje_id', selectedViajeId)
        .eq('numero_asiento', selectedSeat);

      await supabase.from('asientos_bloqueos').insert({
        viaje_id: selectedViajeId,
        numero_asiento: selectedSeat,
        estado: 'PAGADO',
        expira_at: '2099-12-31T23:59:59Z',
        sesion_token: 'PAGADO_PRESENCIAL',
      });

      // 3. Emitir Comprobante a NubeFact / SUNAT
      let sunatResultData: any = undefined;
      const sunatRes = await emitirComprobanteSunat({
        ventaId: ventaData.id,
        tipoDocumento: tipoDoc,
        nroDocumento: nroDoc.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        email: email.trim(),
        razonSocial,
        direccionFiscal,
        origen: selectedTrip.rutas?.origen || 'CUSCO',
        destino: selectedTrip.rutas?.destino || 'QUILLABAMBA',
        asiento: selectedSeat,
        monto: selectedTrip.precio_base,
        fechaViaje: selectedTrip.fecha_viaje,
        horaViaje: selectedTrip.hora_viaje,
      });

      if (sunatRes.success && sunatRes.pdfUrl) {
        sunatResultData = {
          pdfUrl: sunatRes.pdfUrl,
          xmlUrl: sunatRes.xmlUrl,
          serie: sunatRes.serie,
          numero: sunatRes.numero,
        };

        await supabase
          .from('ventas')
          .update({
            comprobante_url: sunatRes.pdfUrl,
            nro_comprobante: `${sunatRes.serie}-${sunatRes.numero}`,
          })
          .eq('id', ventaData.id);
      }

      // 4. Enviar correo si se proveyó email
      if (email.trim()) {
        await sendConfirmationEmail(ventaData as any, sunatResultData);
      }

      // 5. Ofrecer imprimir / compartir boleto de viaje
      Alert.alert(
        '✅ Venta Registrada con Éxito',
        `Pasaje vendido para Asiento #${selectedSeat}.\nComprobante SUNAT: ${
          sunatRes.serie ? `${sunatRes.serie}-${sunatRes.numero}` : 'Generado'
        }\n\n¿Deseas imprimir o compartir el boleto por WhatsApp?`,
        [
          {
            text: 'Cerrar',
            onPress: () => {
              onSaleComplete();
              onClose();
            },
          },
          {
            text: 'Compartir Boleto',
            onPress: async () => {
              await generateAndShareTicket({
                ...ventaData,
                nro_comprobante: sunatRes.serie ? `${sunatRes.serie}-${sunatRes.numero}` : undefined,
                viajes: selectedTrip,
              } as any);
              onSaleComplete();
              onClose();
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('Error registrando venta presencial:', err);
      Alert.alert('Error', err.message || 'No se pudo completar la venta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Venta Presencial en Agencia</Text>
              <Text style={styles.subtitle}>Emitir boleto para cliente en mostrador</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 1. Seleccionar Viaje */}
            <Text style={styles.sectionHeader}>1. Seleccionar Salida / Viaje</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tripScroll}>
              {viajes.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.tripCard, selectedViajeId === v.id && styles.tripCardActive]}
                  onPress={() => setSelectedViajeId(v.id)}
                >
                  <Text style={[styles.tripRoute, selectedViajeId === v.id && styles.textWhite]}>
                    {v.rutas?.origen} ➔ {v.rutas?.destino}
                  </Text>
                  <Text style={[styles.tripMeta, selectedViajeId === v.id && styles.textWhiteSubtle]}>
                    {v.fecha_viaje} • {v.hora_viaje}
                  </Text>
                  <Text style={[styles.tripPrice, selectedViajeId === v.id && styles.textWhite]}>
                    S/ {Number(v.precio_base).toFixed(2)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 2. Seleccionar Asiento */}
            <Text style={styles.sectionHeader}>2. Seleccionar Asiento Disponible</Text>
            {availableSeats.length === 0 ? (
              <Text style={styles.noSeatsText}>⚠️ No hay asientos disponibles en esta salida.</Text>
            ) : (
              <View style={styles.seatGrid}>
                {availableSeats.map((seatNum) => (
                  <TouchableOpacity
                    key={seatNum}
                    style={[styles.seatBtn, selectedSeat === seatNum && styles.seatBtnActive]}
                    onPress={() => setSelectedSeat(seatNum)}
                  >
                    <Text style={[styles.seatBtnText, selectedSeat === seatNum && styles.textWhite]}>
                      #{seatNum}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* 3. Datos del Pasajero */}
            <Text style={styles.sectionHeader}>3. Datos del Pasajero y Comprobante</Text>
            <View style={styles.docTypeRow}>
              {(['DNI', 'RUC', 'CE', 'PASAPORTE'] as TipoDocumento[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.docTypeChip, tipoDoc === t && styles.docTypeChipActive]}
                  onPress={() => setTipoDoc(t)}
                >
                  <Text style={[styles.docTypeText, tipoDoc === t && styles.textWhite]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.lookupRow}>
              <TextInput
                style={styles.inputFlex}
                value={nroDoc}
                onChangeText={setNroDoc}
                placeholder={`N° ${tipoDoc}`}
                keyboardType="numeric"
              />
              {(tipoDoc === 'DNI' || tipoDoc === 'RUC') && (
                <TouchableOpacity
                  style={styles.lookupBtn}
                  onPress={handleLookupDoc}
                  disabled={lookingUpDoc}
                >
                  {lookingUpDoc ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Search size={14} color="#FFF" />
                      <Text style={styles.lookupBtnText}>Consultar</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {tipoDoc === 'RUC' ? (
              <>
                <TextInput
                  style={styles.input}
                  value={razonSocial}
                  onChangeText={setRazonSocial}
                  placeholder="Razón Social de la Empresa"
                />
                <TextInput
                  style={styles.input}
                  value={direccionFiscal}
                  onChangeText={setDireccionFiscal}
                  placeholder="Dirección Fiscal"
                />
              </>
            ) : (
              <View style={styles.nameRow}>
                <TextInput
                  style={styles.inputHalf}
                  value={nombres}
                  onChangeText={setNombres}
                  placeholder="Nombres"
                />
                <TextInput
                  style={styles.inputHalf}
                  value={apellidos}
                  onChangeText={setApellidos}
                  placeholder="Apellidos"
                />
              </View>
            )}

            <TextInput
              style={styles.input}
              value={telefono}
              onChangeText={setTelefono}
              placeholder="Celular / WhatsApp (Obligatorio)"
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Correo electrónico (Opcional)"
              keyboardType="email-address"
            />

            {/* 4. Método de Pago */}
            <Text style={styles.sectionHeader}>4. Método de Pago</Text>
            <View style={styles.paymentMethodsRow}>
              <TouchableOpacity
                style={[styles.payMethodBtn, metodoPago === 'EFECTIVO' && styles.payMethodActive]}
                onPress={() => setMetodoPago('EFECTIVO')}
              >
                <Banknote size={16} color={metodoPago === 'EFECTIVO' ? '#FFF' : THEME.colors.primary} />
                <Text style={[styles.payMethodText, metodoPago === 'EFECTIVO' && styles.textWhite]}>
                  Efectivo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.payMethodBtn, metodoPago === 'YAPE' && styles.payMethodActive]}
                onPress={() => setMetodoPago('YAPE')}
              >
                <QrCode size={16} color={metodoPago === 'YAPE' ? '#FFF' : THEME.colors.primary} />
                <Text style={[styles.payMethodText, metodoPago === 'YAPE' && styles.textWhite]}>
                  Yape
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.payMethodBtn, metodoPago === 'TARJETA' && styles.payMethodActive]}
                onPress={() => setMetodoPago('TARJETA')}
              >
                <CreditCard size={16} color={metodoPago === 'TARJETA' ? '#FFF' : THEME.colors.primary} />
                <Text style={[styles.payMethodText, metodoPago === 'TARJETA' && styles.textWhite]}>
                  POS / Tarjeta
                </Text>
              </TouchableOpacity>
            </View>

            {metodoPago === 'YAPE' && (
              <TextInput
                style={styles.input}
                value={codigoOpYape}
                onChangeText={setCodigoOpYape}
                placeholder="Código de Operación Yape (6 dígitos)"
                keyboardType="numeric"
              />
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleProcessSale}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <CheckCircle size={18} color="#FFF" />
                  <Text style={styles.submitBtnText}>Confirmar y Emitir Boleto</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  closeBtn: {
    padding: 6,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.primary,
    marginTop: 14,
    marginBottom: 8,
  },
  tripScroll: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  tripCard: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 10,
    padding: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    minWidth: 140,
  },
  tripCardActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  tripRoute: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  tripMeta: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  tripPrice: {
    fontSize: 13,
    fontWeight: '900',
    color: THEME.colors.primary,
    marginTop: 4,
  },
  textWhite: {
    color: '#FFF',
  },
  textWhiteSubtle: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  noSeatsText: {
    color: THEME.colors.danger,
    fontSize: 12,
    fontStyle: 'italic',
  },
  seatGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  seatBtn: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  seatBtnActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  seatBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  docTypeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  docTypeChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  docTypeChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  docTypeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  lookupRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  inputFlex: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    fontSize: 13,
  },
  lookupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.accentDark,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  lookupBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    fontSize: 13,
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  inputHalf: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    fontSize: 13,
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  payMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingVertical: 9,
    borderRadius: 8,
  },
  payMethodActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  payMethodText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
    marginBottom: 10,
    ...THEME.shadows.md,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
