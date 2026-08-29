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
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { THEME } from '../constants/theme';
import { Viaje, TipoDocumento } from '../types/database';
import { supabase } from '../lib/supabase';
import { lookupDni, lookupRuc } from '../services/reniecSunatService';
import { emitirComprobanteSunat } from '../services/sunatService';
import { sendConfirmationEmail } from '../services/emailService';
import { generateAndShareTicket } from '../services/ticketPdfService';
import { getPeruTodayString, getPeruTomorrowString, formatPeruDateDisplay, getPeruDate } from '../utils/dateHelper';
import { CalendarModal } from './CalendarModal';
import {
  X,
  Search,
  CheckCircle,
  CreditCard,
  Banknote,
  QrCode,
  MapPin,
  Calendar,
  Clock,
  Car,
  User,
  Phone,
  Mail,
  Armchair,
  Sparkles,
  Navigation,
  FileText,
} from 'lucide-react-native';

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
  const [allViajes, setAllViajes] = useState<Viaje[]>([]);

  // Modo de Venta: Regular (Salida Programada) vs Especial (Viaje No Programado / Ruta Libre)
  const [saleMode, setSaleMode] = useState<'REGULAR' | 'ESPECIAL'>('REGULAR');
  const [especialOrigen, setEspecialOrigen] = useState('');
  const [especialDestino, setEspecialDestino] = useState('');
  const [especialMonto, setEspecialMonto] = useState('100.00');
  const [especialHora, setEspecialHora] = useState('08:00');
  const [especialDescripcion, setEspecialDescripcion] = useState('');

  // Step 1: Filters (Fecha, Ruta, Hora)
  const [selectedDate, setSelectedDate] = useState(getPeruTodayString());
  const [selectedRouteKey, setSelectedRouteKey] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');

  // Step 2: Vehicle selection (4P vs 6P)
  const [selectedVehicleType, setSelectedVehicleType] = useState<'4P' | '6P'>('4P');

  // Active matched trip
  const [activeTrip, setActiveTrip] = useState<Viaje | null>(null);

  // Step 3: Seat selection
  const [occupiedSeats, setOccupiedSeats] = useState<Set<number>>(new Set());
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);

  // Step 4: Passenger form
  const [tipoDoc, setTipoDoc] = useState<TipoDocumento>('DNI');
  const [nroDoc, setNroDoc] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [direccionFiscal, setDireccionFiscal] = useState('');
  const [dniPasajero, setDniPasajero] = useState('');
  const [lookingUpDniPasajero, setLookingUpDniPasajero] = useState(false);
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  // Step 5: Payment method
  const [metodoPago, setMetodoPago] = useState<'EFECTIVO' | 'YAPE' | 'TARJETA'>('EFECTIVO');
  const [codigoOpYape, setCodigoOpYape] = useState('');
  const [lookingUpDoc, setLookingUpDoc] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedDate(getPeruTodayString());
      loadTrips();
    }
  }, [visible]);

  const loadTrips = async () => {
    try {
      const today = getPeruTodayString();
      const { data, error } = await supabase
        .from('viajes')
        .select(`
          id,
          ruta_id,
          vehiculo_id,
          fecha_viaje,
          hora_viaje,
          precio_base,
          estado,
          rutas (id, origen, destino),
          vehiculos (id, nombre_display, total_asientos_pasajero, tipo)
        `)
        .eq('estado', 'ACTIVO')
        .gte('fecha_viaje', today)
        .order('fecha_viaje', { ascending: true })
        .order('hora_viaje', { ascending: true });

      if (error) throw error;

      const trips: Viaje[] = (data as any) || [];
      setAllViajes(trips);

      if (trips.length > 0) {
        const first = trips[0];
        const routeKey = `${first.rutas?.origen}-${first.rutas?.destino}`;
        setSelectedRouteKey(routeKey);
      }
    } catch (e) {
      console.error('Error cargando salidas:', e);
    }
  };

  // Find unique routes available
  const availableRoutes = Array.from(
    new Set(allViajes.map((v) => `${v.rutas?.origen || 'CUSCO'} ➔ ${v.rutas?.destino || 'QUILLABAMBA'}`))
  );

  const nowPeru = getPeruDate();
  const currentHourStr = `${String(nowPeru.getHours()).padStart(2, '0')}:${String(nowPeru.getMinutes()).padStart(2, '0')}`;
  const isToday = selectedDate === getPeruTodayString();

  // Find available hours for selected date & route (only future hours if today)
  const availableHours = Array.from(
    new Set(
      allViajes
        .filter((v) => {
          const rStr = `${v.rutas?.origen || 'CUSCO'} ➔ ${v.rutas?.destino || 'QUILLABAMBA'}`;
          const matchRoute = !selectedRouteKey || rStr === selectedRouteKey;
          const matchDate = v.fecha_viaje === selectedDate;
          if (isToday) {
            const h = v.hora_viaje.substring(0, 5);
            return matchRoute && matchDate && h > currentHourStr;
          }
          return matchRoute && matchDate;
        })
        .map((v) => v.hora_viaje.substring(0, 5))
    )
  );

  // Match the specific trip when route, date, time, and vehicle type are selected
  useEffect(() => {
    if (!selectedRouteKey && availableRoutes.length > 0) {
      setSelectedRouteKey(availableRoutes[0]);
    }
    if (!selectedTime && availableHours.length > 0) {
      setSelectedTime(availableHours[0]);
    }

    const matched = allViajes.find((v) => {
      const rStr = `${v.rutas?.origen || 'CUSCO'} ➔ ${v.rutas?.destino || 'QUILLABAMBA'}`;
      const matchRoute = rStr === selectedRouteKey;
      const matchDate = v.fecha_viaje === selectedDate;
      const matchTime = v.hora_viaje.substring(0, 5) === selectedTime;
      const is6P = v.vehiculos?.nombre_display?.includes('6') || (v.vehiculos as any)?.tipo?.includes('6');
      const matchVehicle = selectedVehicleType === '6P' ? is6P : !is6P;

      return matchRoute && matchDate && matchTime && matchVehicle;
    });

    setActiveTrip(matched || null);
    setSelectedSeat(null);

    if (matched) {
      loadOccupiedSeats(matched.id);
    } else {
      setOccupiedSeats(new Set());
    }
  }, [selectedDate, selectedRouteKey, selectedTime, selectedVehicleType, allViajes]);

  const loadOccupiedSeats = async (viajeId: string) => {
    try {
      const [{ data: ventas }, { data: bloqueos }] = await Promise.all([
        supabase.from('ventas').select('numero_asiento, culqi_charge_id').eq('viaje_id', viajeId),
        supabase.from('asientos_bloqueos').select('numero_asiento, estado, expira_at').eq('viaje_id', viajeId),
      ]);

      const occupied = new Set<number>();

      // 1. Seat 1 is ALWAYS Conductor (driver) - never selectable
      occupied.add(1);

      // 2. Bloqueos activos
      const now = new Date();
      const bloqueosList = (bloqueos as any[]) || [];
      bloqueosList.forEach((b: any) => {
        if (b.sesion_token?.includes('6P') && selectedVehicleType === '4P') return;
        if (b.sesion_token?.includes('4P') && selectedVehicleType === '6P') return;

        if (b.estado === 'PAGADO') {
          occupied.add(b.numero_asiento);
        } else if (b.estado === 'BLOQUEADO' && new Date(b.expira_at) > now) {
          occupied.add(b.numero_asiento);
        }
      });

      // 3. Ventas confirmadas
      ventas?.forEach((v: any) => {
        if (!v.culqi_charge_id?.startsWith('RECHAZADO_')) {
          if (v.culqi_charge_id?.includes('TIPO:6P') && selectedVehicleType === '4P') return;
          if (v.culqi_charge_id?.includes('TIPO:4P') && selectedVehicleType === '6P') return;

          const matchingBloqueo = bloqueosList.find(b => b.numero_asiento === v.numero_asiento);
          if (matchingBloqueo?.sesion_token?.includes('6P') && selectedVehicleType === '4P') return;
          if (matchingBloqueo?.sesion_token?.includes('4P') && selectedVehicleType === '6P') return;

          occupied.add(v.numero_asiento);
        }
      });

      setOccupiedSeats(occupied);
    } catch (e) {
      console.error('Error cargando asientos ocupados:', e);
    }
  };

  const handleLookupDoc = async () => {
    const clean = nroDoc.trim().replace(/\D/g, '');
    if (tipoDoc === 'DNI' && clean.length === 8) {
      setLookingUpDoc(true);
      const res = await lookupDni(clean);
      setLookingUpDoc(false);
      if (res && res.nombres) {
        setNombres(res.nombres);
        setApellidos(`${res.apellidoPaterno} ${res.apellidoMaterno}`.trim());
      } else {
        Alert.alert('Aviso', 'DNI no encontrado en RENIEC. Ingrese los nombres manualmente.');
      }
    } else if (tipoDoc === 'RUC' && clean.length === 11) {
      setLookingUpDoc(true);
      const res = await lookupRuc(clean);
      setLookingUpDoc(false);
      if (res && res.razonSocial) {
        setRazonSocial(res.razonSocial);
        setDireccionFiscal(res.direccion || 'CUSCO');
      } else {
        Alert.alert('Aviso', 'RUC no encontrado en SUNAT. Ingrese los datos manualmente.');
      }
    } else {
      Alert.alert('Formato inválido', `El ${tipoDoc} debe tener ${tipoDoc === 'DNI' ? '8' : '11'} dígitos numéricos.`);
    }
  };

  const handleLookupDniPasajero = async () => {
    const clean = dniPasajero.trim().replace(/\D/g, '');
    if (clean.length === 8) {
      setLookingUpDniPasajero(true);
      const res = await lookupDni(clean);
      setLookingUpDniPasajero(false);
      if (res && res.nombres) {
        setNombres(res.nombres);
        setApellidos(`${res.apellidoPaterno || ''} ${res.apellidoMaterno || ''}`.trim());
      } else {
        Alert.alert('Aviso', 'DNI del pasajero no encontrado en RENIEC. Ingrese los nombres manualmente.');
      }
    } else {
      Alert.alert('Formato inválido', 'El DNI del pasajero debe contener 8 dígitos numéricos.');
    }
  };

  const handleProcessSale = async () => {
    const isEspecial = saleMode === 'ESPECIAL';

    if (!isEspecial) {
      if (!activeTrip) {
        Alert.alert('Error', 'No hay un viaje activo seleccionado para este horario y vehículo.');
        return;
      }

      if (!selectedSeat || selectedSeat === 1) {
        Alert.alert('Error', 'Por favor selecciona un asiento de pasajero válido.');
        return;
      }
    } else {
      if (!especialOrigen.trim()) {
        Alert.alert('Error', 'Por favor ingresa la ciudad o punto de Origen del viaje especial.');
        return;
      }
      if (!especialDestino.trim()) {
        Alert.alert('Error', 'Por favor ingresa la ciudad o punto de Destino del viaje especial.');
        return;
      }
      const montoNum = parseFloat(especialMonto);
      if (isNaN(montoNum) || montoNum <= 0) {
        Alert.alert('Error', 'Por favor ingresa un monto o precio válido mayor a 0.');
        return;
      }
    }

    if (tipoDoc === 'RUC' && (!nroDoc || !razonSocial)) {
      Alert.alert('Error', 'Ingresa el RUC y la Razón Social.');
      return;
    }

    if (tipoDoc !== 'RUC' && (!nroDoc || !nombres || !apellidos)) {
      Alert.alert('Error', 'Ingresa el N° de documento, nombres y apellidos del cliente.');
      return;
    }

    if (!telefono.trim()) {
      Alert.alert('Error', 'Ingresa el número de celular del cliente para enviar su comprobante.');
      return;
    }

    setLoading(true);

    try {
      const cleanO = isEspecial ? especialOrigen.trim().toUpperCase() : (activeTrip?.rutas?.origen || 'CUSCO');
      const cleanD = isEspecial ? especialDestino.trim().toUpperCase() : (activeTrip?.rutas?.destino || 'QUILLABAMBA');
      const finalMonto = isEspecial ? parseFloat(especialMonto) || 0 : (activeTrip?.precio_base || 0);
      const finalDesc = isEspecial 
        ? especialDescripcion.trim().toUpperCase() 
        : (dniPasajero.trim() ? `DNI ${dniPasajero.trim()}` : '');

      let tripId = activeTrip?.id;

      if (isEspecial) {
        // 1. Buscar o crear ruta en Supabase
        let rutaId = '';
        const { data: existingRuta } = await supabase
          .from('rutas')
          .select('id')
          .ilike('origen', cleanO)
          .ilike('destino', cleanD)
          .maybeSingle();

        if (existingRuta?.id) {
          rutaId = existingRuta.id;
        } else {
          const { data: newRuta } = await (supabase.from('rutas') as any)
            .insert({
              origen: cleanO,
              destino: cleanD,
              duracion_estimada: '04:00:00',
              activa: true,
            })
            .select('id')
            .single();
          if (newRuta?.id) rutaId = newRuta.id;
        }

        // 2. Obtener un vehículo disponible para asignar el viaje en la base de datos
        const { data: defaultVehiculo } = await supabase.from('vehiculos').select('id').limit(1).maybeSingle();
        const vehiculoId = defaultVehiculo?.id;

        if (rutaId && vehiculoId) {
          const { data: newViaje } = await (supabase.from('viajes') as any)
            .insert({
              ruta_id: rutaId,
              vehiculo_id: vehiculoId,
              fecha_viaje: selectedDate,
              hora_viaje: especialHora ? (especialHora.length === 5 ? `${especialHora}:00` : especialHora) : '08:00:00',
              precio_base: finalMonto,
              estado: 'ACTIVO',
            })
            .select('id')
            .single();
          if (newViaje?.id) tripId = newViaje.id;
        }

        if (!tripId && allViajes.length > 0) {
          tripId = allViajes[0].id;
        }

        if (!tripId) {
          const { data: anyViaje } = await supabase.from('viajes').select('id').limit(1).maybeSingle();
          if (anyViaje?.id) tripId = anyViaje.id;
        }
      }

      const chargeId = isEspecial
        ? `ESPECIAL-${metodoPago}-${Date.now()}|ORIGEN:${cleanO}|DESTINO:${cleanD}`
        : (metodoPago === 'YAPE'
            ? `YAPE-${codigoOpYape || Date.now()}|TIPO:${selectedVehicleType}`
            : `PRESENCIAL-${metodoPago}-${Date.now()}|TIPO:${selectedVehicleType}`);

      // 1. Insertar Venta en Supabase
      const { data: ventaData, error: vErr } = await supabase
        .from('ventas')
        .insert({
          viaje_id: tripId,
          numero_asiento: isEspecial ? 0 : selectedSeat,
          tipo_documento: tipoDoc,
          nro_documento: nroDoc.trim(),
          nombres: nombres.trim() || razonSocial.trim(),
          apellidos: apellidos.trim(),
          email: email.trim() || 'reservas@turismotunkychasky.com.pe',
          telefono: telefono.trim(),
          monto_pagado: finalMonto,
          culqi_charge_id: chargeId,
          metodo_pago: metodoPago,
          razon_social: razonSocial.trim(),
          direccion_fiscal: direccionFiscal.trim(),
          descripcion_opcional: finalDesc,
          estado: 'CONFIRMADO',
          comprobante_emitido: true,
        })
        .select()
        .single();

      if (vErr) throw vErr;

      // 2. Si es regular, bloquear permanentemente el asiento en asientos_bloqueos
      if (!isEspecial && selectedSeat && activeTrip?.id) {
        await supabase
          .from('asientos_bloqueos')
          .delete()
          .eq('viaje_id', activeTrip.id)
          .eq('numero_asiento', selectedSeat);

        await supabase.from('asientos_bloqueos').insert({
          viaje_id: activeTrip.id,
          numero_asiento: selectedSeat,
          estado: 'PAGADO',
          expira_at: '2099-12-31T23:59:59Z',
          sesion_token: `PAGADO_${selectedVehicleType}`,
        });
      }

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
        descripcionOpcional: finalDesc,
        dniPasajero: isEspecial ? '' : dniPasajero.trim(),
        origen: cleanO,
        destino: cleanD,
        asiento: isEspecial ? 0 : (selectedSeat || 1),
        monto: finalMonto,
        fechaViaje: selectedDate,
        horaViaje: isEspecial ? (especialHora || '08:00') : (activeTrip?.hora_viaje || '08:00'),
        esViajeEspecial: isEspecial,
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

      // 5. Ofrecer compartir comprobante oficial
      const compTipo = tipoDoc === 'RUC' ? 'Factura Electrónica' : 'Boleta de Venta Electrónica';
      const compNro = sunatRes.serie ? `${sunatRes.serie}-${sunatRes.numero}` : 'Generado';

      if (isEspecial) {
        // En VIAJE ESPECIAL: NO se genera boleto de viaje por asiento, SOLO Factura / Boleta SUNAT
        Alert.alert(
          '✅ Comprobante Emitido con Éxito',
          `Se emitió la ${compTipo} (${compNro}) para el Viaje Especial:\n\n• Ruta: ${cleanO} ➔ ${cleanD}\n• Total: S/ ${finalMonto.toFixed(2)}\n• Cliente: ${nombres.trim() || razonSocial.trim()}`,
          [
            {
              text: 'Cerrar',
              onPress: () => {
                onSaleComplete();
                onClose();
              },
            },
            {
              text: '📱 Enviar por WhatsApp',
              onPress: () => {
                if (sunatRes.pdfUrl) {
                  const textMsg = encodeURIComponent(
                    `*INVERSIONES TUNKY CHASKY S.R.L.*\n\nEstimado(a) *${nombres.trim() || razonSocial.trim()}*,\nLe adjuntamos su *${compTipo} ${compNro}* por el servicio de transporte *${cleanO} ➔ ${cleanD}*.\n\n📄 *Descargar Comprobante PDF (SUNAT):*\n${sunatRes.pdfUrl}\n\n¡Gracias por su preferencia!`
                  );
                  const cleanPhone = telefono.trim().replace(/\D/g, '');
                  const phoneWithCode = cleanPhone.startsWith('51') ? cleanPhone : `51${cleanPhone}`;
                  Linking.openURL(`https://wa.me/${phoneWithCode}?text=${textMsg}`);
                }
                onSaleComplete();
                onClose();
              },
            },
            {
              text: '📄 Ver PDF',
              onPress: () => {
                if (sunatRes.pdfUrl) {
                  Linking.openURL(sunatRes.pdfUrl);
                }
                onSaleComplete();
                onClose();
              },
            },
          ]
        );
      } else {
        // En VIAJE REGULAR: Ofrecer compartir boleto de viaje por asiento
        Alert.alert(
          '✅ Venta Registrada con Éxito',
          `Pasaje vendido para Asiento #${selectedSeat} (${activeTrip?.rutas?.origen} ➔ ${activeTrip?.rutas?.destino}).\n\nComprobante SUNAT: ${compNro}\n\n¿Deseas enviar el boleto de viaje por WhatsApp al pasajero?`,
          [
            {
              text: 'Cerrar',
              onPress: () => {
                onSaleComplete();
                onClose();
              },
            },
            {
              text: '📱 Enviar por WhatsApp',
              onPress: async () => {
                await generateAndShareTicket({
                  ...ventaData,
                  nro_comprobante: sunatRes.serie ? `${sunatRes.serie}-${sunatRes.numero}` : undefined,
                  viajes: activeTrip,
                } as any);
                onSaleComplete();
                onClose();
              },
            },
          ]
        );
      }
    } catch (err: any) {
      console.error('Error procesando venta:', err);
      Alert.alert('Error', err.message || 'No se pudo completar la venta.');
    } finally {
      setLoading(false);
    }
  };

  // Define seats configuration based on vehicle type
  // Seat #1 is Conductor. 4P has seats 2, 3, 4, 5. 6P has seats 2, 3, 4, 5, 6, 7.
  const passengerSeats = selectedVehicleType === '4P' ? [2, 3, 4, 5] : [2, 3, 4, 5, 6, 7];

  const getSeatLabel = (n: number) => {
    if (n === 2) return '#2 Copiloto';
    if (n === 3) return '#3 Fila 2 Izq';
    if (n === 4) return '#4 Fila 2 Cen';
    if (n === 5) return '#5 Fila 2 Der';
    if (n === 6) return '#6 Fila 3 Izq';
    if (n === 7) return '#7 Fila 3 Der';
    return `#${n}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Venta Presencial en Agencia</Text>
              <Text style={styles.subtitle}>Emitir boleto para cliente en mostrador</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false} 
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 220 }}
          >
            {/* SELECTOR DE MODO: SALIDA REGULAR VS VIAJE ESPECIAL */}
            <View style={styles.modeTabsRow}>
              <TouchableOpacity
                style={[styles.modeTab, saleMode === 'REGULAR' && styles.modeTabActive]}
                onPress={() => setSaleMode('REGULAR')}
              >
                <Navigation size={14} color={saleMode === 'REGULAR' ? '#FFF' : THEME.colors.primary} />
                <Text style={[styles.modeTabText, saleMode === 'REGULAR' && styles.textWhite]}>
                  Salida Regular (Pasajes)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeTab, saleMode === 'ESPECIAL' && styles.modeTabSpecialActive]}
                onPress={() => setSaleMode('ESPECIAL')}
              >
                <Sparkles size={14} color={saleMode === 'ESPECIAL' ? '#FFF' : '#742284'} />
                <Text style={[styles.modeTabText, saleMode === 'ESPECIAL' && styles.textWhite]}>
                  ✨ Viaje Especial (Ruta Libre)
                </Text>
              </TouchableOpacity>
            </View>

            {saleMode === 'ESPECIAL' ? (
              /* ==================== MODO VIAJE ESPECIAL (RUTA LIBRE / SIN ASIENTOS) ==================== */
              <View>
                <View style={styles.specialCardBanner}>
                  <Sparkles size={18} color="#742284" />
                  <Text style={styles.specialCardText}>
                    En viajes especiales no se asigna vehículo ni asiento. Se emite directamente la Factura o Boleta Electrónica de SUNAT.
                  </Text>
                </View>

                <Text style={styles.stepTitle}>1. Origen, Destino y Tarifa del Viaje Especial</Text>

                {/* Origen y Destino */}
                <View style={styles.nameRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Ciudad de Origen (Salida):</Text>
                    <TextInput
                      style={[styles.input, { fontWeight: '700' }]}
                      value={especialOrigen}
                      onChangeText={(text) => setEspecialOrigen(text.toUpperCase())}
                      placeholder="Ej: CUSCO"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Ciudad de Destino (Llegada):</Text>
                    <TextInput
                      style={[styles.input, { fontWeight: '700' }]}
                      value={especialDestino}
                      onChangeText={(text) => setEspecialDestino(text.toUpperCase())}
                      placeholder="Ej: KITENI, OCONGATE"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                {/* Fecha y Tarifa Total */}
                <View style={styles.nameRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Fecha del Servicio:</Text>
                    <TouchableOpacity
                      style={styles.dateSelectorBtn}
                      onPress={() => setShowCalendar(true)}
                    >
                      <Calendar size={14} color={THEME.colors.primary} />
                      <Text style={styles.dateSelectorBtnText}>{formatPeruDateDisplay(selectedDate)}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Monto Total Pactado (S/):</Text>
                    <TextInput
                      style={[styles.input, { fontWeight: '800', color: THEME.colors.primary }]}
                      value={especialMonto}
                      onChangeText={setEspecialMonto}
                      placeholder="Ej: 150.00"
                      placeholderTextColor="#94A3B8"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                {/* Descripción / Detalle del Viaje Especial */}
                <Text style={styles.fieldLabel}>Descripción / Detalle del Viaje Especial (Opcional):</Text>
                <TextInput
                  style={styles.input}
                  value={especialDescripcion}
                  onChangeText={(text) => setEspecialDescripcion(text.toUpperCase())}
                  placeholder="Ej: TRASLADO PRIVADO HOTEL / SERVICIO EXCLUSIVO"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                />
                <Text style={styles.descHelpText}>
                  💡 Se imprimirá en SUNAT: SERVICIO DE TRANSPORTE {especialOrigen || '(ORIGEN)'} {especialDestino || '(DESTINO)'} {especialDescripcion}
                </Text>
              </View>
            ) : (
              /* ==================== MODO SALIDA REGULAR (HORARIO, VEHÍCULO Y ASIENTO) ==================== */
              <View>
                {/* 1. SELECCIONAR FECHA */}
                <Text style={styles.stepTitle}>1. Seleccionar Fecha y Salida</Text>
                <View style={styles.dateSelectorRow}>
                  <TouchableOpacity
                    style={[styles.dateChip, selectedDate === getPeruTodayString() && styles.chipActive]}
                    onPress={() => setSelectedDate(getPeruTodayString())}
                  >
                    <Calendar size={14} color={selectedDate === getPeruTodayString() ? '#FFF' : THEME.colors.textSecondary} />
                    <Text style={[styles.chipText, selectedDate === getPeruTodayString() && styles.textWhite]}>
                      Hoy ({formatPeruDateDisplay(getPeruTodayString()).substring(0, 5)})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dateChip, selectedDate === getPeruTomorrowString() && styles.chipActive]}
                    onPress={() => setSelectedDate(getPeruTomorrowString())}
                  >
                    <Calendar size={14} color={selectedDate === getPeruTomorrowString() ? '#FFF' : THEME.colors.textSecondary} />
                    <Text style={[styles.chipText, selectedDate === getPeruTomorrowString() && styles.textWhite]}>
                      Mañana ({formatPeruDateDisplay(getPeruTomorrowString()).substring(0, 5)})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.dateChip, 
                      selectedDate !== getPeruTodayString() && selectedDate !== getPeruTomorrowString() && styles.chipActive
                    ]}
                    onPress={() => setShowCalendar(true)}
                  >
                    <Calendar size={14} color={selectedDate !== getPeruTodayString() && selectedDate !== getPeruTomorrowString() ? '#FFF' : THEME.colors.primary} />
                    <Text style={[
                      styles.chipText, 
                      selectedDate !== getPeruTodayString() && selectedDate !== getPeruTomorrowString() && styles.textWhite
                    ]}>
                      {selectedDate !== getPeruTodayString() && selectedDate !== getPeruTomorrowString() 
                        ? formatPeruDateDisplay(selectedDate).substring(0, 5) 
                        : '📅 Calendario'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Selector de Ruta */}
                <Text style={styles.subLabel}>Ruta:</Text>
                <View style={styles.wrapRow}>
                  {availableRoutes.map((rStr) => (
                    <TouchableOpacity
                      key={rStr}
                      style={[styles.routeChip, selectedRouteKey === rStr && styles.chipActive]}
                      onPress={() => setSelectedRouteKey(rStr)}
                    >
                      <MapPin size={13} color={selectedRouteKey === rStr ? '#FFF' : THEME.colors.primary} />
                      <Text style={[styles.chipText, selectedRouteKey === rStr && styles.textWhite]}>{rStr}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Selector de Horario */}
                <Text style={styles.subLabel}>Hora de Salida:</Text>
                <View style={styles.wrapRow}>
                  {availableHours.length === 0 ? (
                    <Text style={styles.emptyNotice}>⚠️ No hay salidas programadas para esta fecha y ruta.</Text>
                  ) : (
                    availableHours.map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[styles.timeChip, selectedTime === h && styles.chipActive]}
                        onPress={() => setSelectedTime(h)}
                      >
                        <Clock size={13} color={selectedTime === h ? '#FFF' : THEME.colors.textPrimary} />
                        <Text style={[styles.chipText, selectedTime === h && styles.textWhite]}>{h}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>

                {/* 2. SELECCIONAR TIPO DE VEHÍCULO */}
                <Text style={styles.stepTitle}>2. Seleccionar Tipo de Vehículo</Text>
                <View style={styles.vehicleRow}>
                  <TouchableOpacity
                    style={[styles.vehicleBtn, selectedVehicleType === '4P' && styles.vehicleBtnActive]}
                    onPress={() => setSelectedVehicleType('4P')}
                  >
                    <Car size={20} color={selectedVehicleType === '4P' ? '#FFF' : THEME.colors.primary} />
                    <View>
                      <Text style={[styles.vehicleTitle, selectedVehicleType === '4P' && styles.textWhite]}>
                        Camioneta 4 Pasajeros
                      </Text>
                      <Text style={[styles.vehicleSub, selectedVehicleType === '4P' && styles.textWhiteSubtle]}>
                        4 Asientos disponibles
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.vehicleBtn, selectedVehicleType === '6P' && styles.vehicleBtnActive]}
                    onPress={() => setSelectedVehicleType('6P')}
                  >
                    <Car size={20} color={selectedVehicleType === '6P' ? '#FFF' : THEME.colors.primary} />
                    <View>
                      <Text style={[styles.vehicleTitle, selectedVehicleType === '6P' && styles.textWhite]}>
                        Camioneta 6 Pasajeros
                      </Text>
                      <Text style={[styles.vehicleSub, selectedVehicleType === '6P' && styles.textWhiteSubtle]}>
                        6 Asientos disponibles
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* 3. SELECCIONAR ASIENTO */}
                <Text style={styles.stepTitle}>3. Seleccionar Asiento</Text>
                <View style={styles.seatLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: THEME.colors.seatAvailable }]} />
                    <Text style={styles.legendText}>Disponible</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: THEME.colors.seatSold }]} />
                    <Text style={styles.legendText}>Ocupado</Text>
                  </View>
                </View>

                <View style={styles.seatsGrid}>
                  {/* Asiento 1 - Conductor (No seleccionable) */}
                  <View style={[styles.seatCard, styles.seatDriver]}>
                    <Armchair size={16} color="#94A3B8" />
                    <Text style={styles.seatDriverText}>🪑 Conductor (Chofer)</Text>
                  </View>

                  {/* Passenger Seats */}
                  {passengerSeats.map((seatNum) => {
                    const isOccupied = occupiedSeats.has(seatNum);
                    const isSelected = selectedSeat === seatNum;

                    return (
                      <TouchableOpacity
                        key={seatNum}
                        style={[
                          styles.seatCard,
                          isOccupied && styles.seatOccupied,
                          !isOccupied && styles.seatAvailable,
                          isSelected && styles.seatSelected,
                        ]}
                        disabled={isOccupied}
                        onPress={() => setSelectedSeat(seatNum)}
                      >
                        <Armchair size={16} color={isSelected ? '#FFF' : isOccupied ? '#FFF' : THEME.colors.primary} />
                        <Text
                          style={[
                            styles.seatText,
                            isSelected && styles.textWhite,
                            isOccupied && styles.textWhite,
                          ]}
                        >
                          {getSeatLabel(seatNum)} {isOccupied ? '(Ocupado)' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Price Badge */}
                {activeTrip && (
                  <View style={styles.priceSummaryBox}>
                    <Text style={styles.priceSummaryLabel}>Precio del Pasaje:</Text>
                    <Text style={styles.priceSummaryValue}>S/ {Number(activeTrip.precio_base).toFixed(2)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* 4. DATOS DEL PASAJERO */}
            <Text style={styles.stepTitle}>
              {saleMode === 'ESPECIAL' ? '2. Datos del Cliente / Facturación' : '4. Datos del Pasajero y Comprobante'}
            </Text>
            <View style={styles.docTypeRow}>
              {(['DNI', 'RUC', 'CE', 'PASAPORTE'] as TipoDocumento[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.docTypeChip, tipoDoc === t && styles.chipActive]}
                  onPress={() => setTipoDoc(t)}
                >
                  <Text style={[styles.docTypeText, tipoDoc === t && styles.textWhite]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* N° Documento + Botón Consultar */}
            <Text style={styles.fieldLabel}>Número de Documento ({tipoDoc}):</Text>
            <View style={styles.lookupRow}>
              <TextInput
                style={styles.inputFlex}
                value={nroDoc}
                onChangeText={setNroDoc}
                placeholder={`Ej: ${tipoDoc === 'DNI' ? '45892147' : '20613271701'}`}
                placeholderTextColor="#94A3B8"
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
                      <Text style={styles.lookupBtnText}>Consultar {tipoDoc}</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Nombres / Razón Social */}
            {tipoDoc === 'RUC' && (
              <>
                <Text style={styles.fieldLabel}>Razón Social de la Empresa:</Text>
                <TextInput
                  style={styles.input}
                  value={razonSocial}
                  onChangeText={setRazonSocial}
                  placeholder="Nombre de la Empresa"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.fieldLabel}>Dirección Fiscal:</Text>
                <TextInput
                  style={styles.input}
                  value={direccionFiscal}
                  onChangeText={setDireccionFiscal}
                  placeholder="Dirección Fiscal para Factura"
                  placeholderTextColor="#94A3B8"
                />

                {/* DNI del Pasajero para Factura */}
                <Text style={styles.fieldLabel}>DNI del Pasajero (Quien va a viajar):</Text>
                <View style={styles.lookupRow}>
                  <TextInput
                    style={styles.inputFlex}
                    value={dniPasajero}
                    onChangeText={setDniPasajero}
                    placeholder="Ej: 42339734"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    maxLength={8}
                  />
                  <TouchableOpacity
                    style={styles.lookupBtn}
                    onPress={handleLookupDniPasajero}
                    disabled={lookingUpDniPasajero}
                  >
                    {lookingUpDniPasajero ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Search size={14} color="#FFF" />
                        <Text style={styles.lookupBtnText}>Consultar DNI</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={styles.nameRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{tipoDoc === 'RUC' ? 'Nombres Pasajero:' : 'Nombres:'}</Text>
                <TextInput
                  style={styles.input}
                  value={nombres}
                  onChangeText={setNombres}
                  placeholder="Nombres"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{tipoDoc === 'RUC' ? 'Apellidos Pasajero:' : 'Apellidos:'}</Text>
                <TextInput
                  style={styles.input}
                  value={apellidos}
                  onChangeText={setApellidos}
                  placeholder="Apellidos"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Celular / WhatsApp */}
            <Text style={styles.fieldLabel}>Número de Celular / WhatsApp (Obligatorio):</Text>
            <View style={styles.inputWithIcon}>
              <Phone size={16} color={THEME.colors.primary} />
              <TextInput
                style={styles.inputInner}
                value={telefono}
                onChangeText={setTelefono}
                placeholder="Ej: 984123456"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />
            </View>

            {/* Correo Electrónico */}
            <Text style={styles.fieldLabel}>Correo Electrónico (Opcional):</Text>
            <View style={styles.inputWithIcon}>
              <Mail size={16} color={THEME.colors.primary} />
              <TextInput
                style={styles.inputInner}
                value={email}
                onChangeText={setEmail}
                placeholder="cliente@gmail.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* MÉTODO DE PAGO */}
            <Text style={styles.stepTitle}>
              {saleMode === 'ESPECIAL' ? '3. Método de Pago' : '5. Método de Pago'}
            </Text>
            <View style={styles.paymentMethodsRow}>
              <TouchableOpacity
                style={[styles.payMethodBtn, metodoPago === 'EFECTIVO' && styles.chipActive]}
                onPress={() => setMetodoPago('EFECTIVO')}
              >
                <Banknote size={16} color={metodoPago === 'EFECTIVO' ? '#FFF' : THEME.colors.primary} />
                <Text style={[styles.payMethodText, metodoPago === 'EFECTIVO' && styles.textWhite]}>
                  Efectivo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.payMethodBtn, metodoPago === 'YAPE' && styles.chipActive]}
                onPress={() => setMetodoPago('YAPE')}
              >
                <QrCode size={16} color={metodoPago === 'YAPE' ? '#FFF' : THEME.colors.primary} />
                <Text style={[styles.payMethodText, metodoPago === 'YAPE' && styles.textWhite]}>
                  Yape
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.payMethodBtn, metodoPago === 'TARJETA' && styles.chipActive]}
                onPress={() => setMetodoPago('TARJETA')}
              >
                <CreditCard size={16} color={metodoPago === 'TARJETA' ? '#FFF' : THEME.colors.primary} />
                <Text style={[styles.payMethodText, metodoPago === 'TARJETA' && styles.textWhite]}>
                  Tarjeta POS
                </Text>
              </TouchableOpacity>
            </View>

            {metodoPago === 'YAPE' && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.fieldLabel}>Código de Operación Yape (6 dígitos):</Text>
                <TextInput
                  style={styles.input}
                  value={codigoOpYape}
                  onChangeText={setCodigoOpYape}
                  placeholder="Ej: 123456"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
              </View>
            )}

            {/* BOTÓN FINAL DE EMISIÓN */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                saleMode === 'ESPECIAL' && { backgroundColor: '#742284' }
              ]}
              onPress={handleProcessSale}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  {saleMode === 'ESPECIAL' ? (
                    <FileText size={18} color="#FFF" />
                  ) : (
                    <CheckCircle size={18} color="#FFF" />
                  )}
                  <Text style={styles.submitBtnText}>
                    {saleMode === 'ESPECIAL'
                      ? `Emitir ${tipoDoc === 'RUC' ? 'Factura' : 'Boleta'} SUNAT (S/ ${Number(parseFloat(especialMonto) || 0).toFixed(2)})`
                      : 'Confirmar y Emitir Boleto SUNAT'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>

          {/* Calendar Picker Modal */}
          <CalendarModal
            visible={showCalendar}
            selectedDate={selectedDate}
            onSelectDate={(newDate) => setSelectedDate(newDate)}
            onClose={() => setShowCalendar(false)}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '94%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  closeBtn: {
    padding: 6,
  },
  modeTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  modeTabActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  modeTabSpecialActive: {
    backgroundColor: '#742284',
    borderColor: '#742284',
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  specialCardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    padding: 12,
    borderRadius: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  specialCardText: {
    flex: 1,
    fontSize: 12,
    color: '#6B21A8',
    fontWeight: '600',
    lineHeight: 16,
  },
  dateSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  dateSelectorBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  descHelpText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.primary,
    marginTop: 14,
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 4,
    marginTop: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
    marginTop: 8,
  },
  dateSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  routeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  chipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  textWhite: {
    color: '#FFF',
  },
  textWhiteSubtle: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  emptyNotice: {
    color: THEME.colors.danger,
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  vehicleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  vehicleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surfaceSubtle,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  vehicleBtnActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  vehicleTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  vehicleSub: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
  },
  seatLegend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  seatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  seatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    minWidth: '47%',
  },
  seatDriver: {
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1',
    opacity: 0.8,
  },
  seatDriverText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  seatAvailable: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  seatOccupied: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    opacity: 0.6,
  },
  seatSelected: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  seatText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  priceSummaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.primarySoft,
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  priceSummaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  priceSummaryValue: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.primary,
  },
  docTypeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  docTypeChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  docTypeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  lookupRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inputFlex: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    fontSize: 14,
    color: '#0F172A',
  },
  lookupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.accentDark,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
  },
  lookupBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  input: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    fontSize: 14,
    color: '#0F172A',
  },
  nameRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  inputInner: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  payMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingVertical: 10,
    borderRadius: 8,
  },
  payMethodText: {
    fontSize: 12,
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
    marginTop: 18,
    marginBottom: 20,
    ...THEME.shadows.md,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
