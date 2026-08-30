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
  Platform
} from 'react-native';
import { THEME } from '../constants/theme';
import { Ruta, Vehiculo } from '../types/database';
import { supabase } from '../lib/supabase';
import { X, Plus, Calendar, Clock, DollarSign, ChevronRight, MapPin, Sparkles } from 'lucide-react-native';
import { CalendarModal } from './CalendarModal';
import { TimePickerModal } from './TimePickerModal';
import { getPeruTodayString, getPeruTomorrowString, formatPeruDateDisplay } from '../utils/dateHelper';

interface CreateTripModalProps {
  visible: boolean;
  onClose: () => void;
  onTripCreated: () => void;
}

export const CreateTripModal: React.FC<CreateTripModalProps> = ({
  visible,
  onClose,
  onTripCreated,
}) => {
  const [loading, setLoading] = useState(false);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);

  const [selectedRutaId, setSelectedRutaId] = useState('');
  const [selectedVehiculoId, setSelectedVehiculoId] = useState('');
  const [fechaViaje, setFechaViaje] = useState(getPeruTodayString());
  const [horaViaje, setHoraViaje] = useState('07:00');
  const [precioBase, setPrecioBase] = useState('50.00');

  // Nueva Ruta Personalizada
  const [showNewRouteForm, setShowNewRouteForm] = useState(false);
  const [newOrigen, setNewOrigen] = useState('');
  const [newDestino, setNewDestino] = useState('');
  const [newDuracion, setNewDuracion] = useState('05:00:00');
  const [savingRoute, setSavingRoute] = useState(false);

  // Modales de Selección Visual
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      loadFormData();
      setShowNewRouteForm(false);
    }
  }, [visible]);

  const loadFormData = async () => {
    try {
      let { data: rData } = await supabase.from('rutas').select('*').eq('activa', true);
      const { data: vData } = await supabase.from('vehiculos').select('*').eq('activo', true);

      let listRutas = rData || [];
      const standardRoutes = [
        { origen: 'CUSCO', destino: 'QUILLABAMBA', duracion_estimada: '06:00:00', activa: true },
        { origen: 'QUILLABAMBA', destino: 'CUSCO', duracion_estimada: '06:00:00', activa: true },
        { origen: 'QUILLABAMBA', destino: 'KITENI', duracion_estimada: '03:00:00', activa: true },
        { origen: 'KITENI', destino: 'QUILLABAMBA', duracion_estimada: '03:00:00', activa: true },
        { origen: 'CUSCO', destino: 'KITENI', duracion_estimada: '08:30:00', activa: true },
        { origen: 'KITENI', destino: 'CUSCO', duracion_estimada: '08:30:00', activa: true },
      ];

      for (const st of standardRoutes) {
        const found = listRutas.find(
          (r: any) => r.origen.toUpperCase() === st.origen && r.destino.toUpperCase() === st.destino
        );
        if (!found) {
          try {
            const { data: newR } = await supabase.from('rutas').insert(st).select('*').single();
            if (newR) listRutas.push(newR);
          } catch (_e) {}
        }
      }

      if (listRutas.length > 0) {
        setRutas(listRutas);
        if (!selectedRutaId) setSelectedRutaId(listRutas[0].id);
      }
      if (vData && vData.length > 0) {
        setVehiculos(vData);
        if (!selectedVehiculoId) setSelectedVehiculoId('BOTH');
      }
    } catch (e) {
      console.error('Error cargando rutas/vehículos:', e);
    }
  };

  const handleSaveNewRoute = async () => {
    const orig = newOrigen.trim().toUpperCase();
    const dest = newDestino.trim().toUpperCase();

    if (!orig || !dest) {
      Alert.alert('Ruta incompleta', 'Por favor ingresa tanto la ciudad de origen como la de destino.');
      return;
    }

    if (orig === dest) {
      Alert.alert('Error', 'El origen y destino no pueden ser iguales.');
      return;
    }

    setSavingRoute(true);
    try {
      // Verificar si ya existe
      const existing = rutas.find(
        (r) => r.origen.toUpperCase() === orig && r.destino.toUpperCase() === dest
      );

      if (existing) {
        setSelectedRutaId(existing.id);
        setShowNewRouteForm(false);
        setNewOrigen('');
        setNewDestino('');
        Alert.alert('Ruta seleccionada', `La ruta ${orig} ➔ ${dest} ya existía y ha sido seleccionada.`);
        return;
      }

      const { data: insertedRoute, error } = await supabase
        .from('rutas')
        .insert({
          origen: orig,
          destino: dest,
          duracion_estimada: newDuracion.trim() || '05:00:00',
          activa: true,
        })
        .select('*')
        .single();

      if (error) throw error;

      if (insertedRoute) {
        const updated = [...rutas, insertedRoute];
        setRutas(updated);
        setSelectedRutaId(insertedRoute.id);
        setShowNewRouteForm(false);
        setNewOrigen('');
        setNewDestino('');
        Alert.alert('✅ Ruta Creada', `¡La ruta ${orig} ➔ ${dest} fue registrada y seleccionada exitosamente!`);
      }
    } catch (err: any) {
      console.error('Error creando nueva ruta:', err);
      Alert.alert('Error', err.message || 'No se pudo registrar la nueva ruta.');
    } finally {
      setSavingRoute(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedRutaId || !selectedVehiculoId || !fechaViaje || !horaViaje || !precioBase) {
      Alert.alert('Error', 'Por favor completa todos los campos.');
      return;
    }

    const priceNum = parseFloat(precioBase);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Error', 'Ingresa un precio válido mayor a 0.');
      return;
    }

    setLoading(true);
    try {
      if (selectedVehiculoId === 'BOTH') {
        const inserts = vehiculos.map((v) => ({
          ruta_id: selectedRutaId,
          vehiculo_id: v.id,
          fecha_viaje: fechaViaje,
          hora_viaje: horaViaje.length === 5 ? `${horaViaje}:00` : horaViaje,
          precio_base: priceNum,
          estado: 'ACTIVO',
        }));

        const { error } = await supabase.from('viajes').insert(inserts);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('viajes').insert({
          ruta_id: selectedRutaId,
          vehiculo_id: selectedVehiculoId,
          fecha_viaje: fechaViaje,
          hora_viaje: horaViaje.length === 5 ? `${horaViaje}:00` : horaViaje,
          precio_base: priceNum,
          estado: 'ACTIVO',
        });
        if (error) throw error;
      }

      Alert.alert('Éxito', '¡Salida programada exitosamente!');
      onTripCreated();
      onClose();
    } catch (err: any) {
      console.error('Error creando viaje:', err);
      Alert.alert('Error al crear viaje', err.message || 'No se pudo registrar la salida.');
    } finally {
      setLoading(false);
    }
  };

  const todayStr = getPeruTodayString();
  const tomorrowStr = getPeruTomorrowString();

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Programar Nueva Salida</Text>
              <Text style={styles.subtitle}>Crea una ruta y horario disponible para reserva</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 60 }}
          >
            {/* Ruta Selector */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.label}>Ruta de Viaje:</Text>
              <TouchableOpacity
                style={styles.addRouteToggleBtn}
                onPress={() => setShowNewRouteForm(!showNewRouteForm)}
              >
                <Plus size={14} color={THEME.colors.primary} />
                <Text style={styles.addRouteToggleText}>
                  {showNewRouteForm ? 'Cerrar Nueva Ruta' : '+ Nueva Ruta'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Inline New Route Form for Employees */}
            {showNewRouteForm && (
              <View style={styles.newRouteBox}>
                <View style={styles.newRouteHeader}>
                  <Sparkles size={16} color={THEME.colors.primary} />
                  <Text style={styles.newRouteTitle}>Registrar Nueva Ruta</Text>
                </View>

                <View style={styles.newRouteInputGroup}>
                  <Text style={styles.inputSubLabel}>Ciudad de Origen:</Text>
                  <TextInput
                    style={styles.newRouteInput}
                    value={newOrigen}
                    onChangeText={(t) => setNewOrigen(t.toUpperCase())}
                    placeholder="Ej. CUSCO, QUILLABAMBA, KITENI..."
                    placeholderTextColor={THEME.colors.textMuted}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.newRouteInputGroup}>
                  <Text style={styles.inputSubLabel}>Ciudad de Destino:</Text>
                  <TextInput
                    style={styles.newRouteInput}
                    value={newDestino}
                    onChangeText={(t) => setNewDestino(t.toUpperCase())}
                    placeholder="Ej. QUILLABAMBA, ECHARATI, CALCA..."
                    placeholderTextColor={THEME.colors.textMuted}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.newRouteInputGroup}>
                  <Text style={styles.inputSubLabel}>Duración Estimada (HH:MM:SS):</Text>
                  <TextInput
                    style={styles.newRouteInput}
                    value={newDuracion}
                    onChangeText={setNewDuracion}
                    placeholder="05:00:00"
                    placeholderTextColor={THEME.colors.textMuted}
                  />
                </View>

                <TouchableOpacity
                  style={styles.saveRouteBtn}
                  onPress={handleSaveNewRoute}
                  disabled={savingRoute}
                >
                  {savingRoute ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <MapPin size={16} color="#FFF" />
                      <Text style={styles.saveRouteBtnText}>Guardar y Usar Ruta</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.chipRow}>
              {rutas.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.chip, selectedRutaId === r.id && styles.chipActive]}
                  onPress={() => setSelectedRutaId(r.id)}
                >
                  <Text style={[styles.chipText, selectedRutaId === r.id && styles.chipTextActive]}>
                    {r.origen} ➔ {r.destino}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Vehículo Selector */}
            <Text style={styles.label}>Vehículo:</Text>
            <View style={styles.chipRow}>
              {vehiculos.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.chip, selectedVehiculoId === v.id && styles.chipActive]}
                  onPress={() => setSelectedVehiculoId(v.id)}
                >
                  <Text style={[styles.chipText, selectedVehiculoId === v.id && styles.chipTextActive]}>
                    {v.nombre_display}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.chip, selectedVehiculoId === 'BOTH' && styles.chipActive]}
                onPress={() => setSelectedVehiculoId('BOTH')}
              >
                <Text style={[styles.chipText, selectedVehiculoId === 'BOTH' && styles.chipTextActive]}>
                  🚐 Ambas Camionetas (4P + 6P)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Fecha con Calendario */}
            <Text style={styles.label}>Fecha del Viaje:</Text>
            <View style={styles.quickDateRow}>
              <TouchableOpacity
                style={[styles.quickDateBtn, fechaViaje === todayStr && styles.quickDateBtnActive]}
                onPress={() => setFechaViaje(todayStr)}
              >
                <Text style={[styles.quickDateText, fechaViaje === todayStr && styles.quickDateTextActive]}>
                  Hoy ({formatPeruDateDisplay(todayStr).substring(0, 5)})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickDateBtn, fechaViaje === tomorrowStr && styles.quickDateBtnActive]}
                onPress={() => setFechaViaje(tomorrowStr)}
              >
                <Text style={[styles.quickDateText, fechaViaje === tomorrowStr && styles.quickDateTextActive]}>
                  Mañana ({formatPeruDateDisplay(tomorrowStr).substring(0, 5)})
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.pickerTriggerBox}
              onPress={() => setShowCalendar(true)}
            >
              <View style={styles.pickerTriggerLeft}>
                <Calendar size={18} color={THEME.colors.primary} />
                <Text style={styles.pickerTriggerValue}>
                  {formatPeruDateDisplay(fechaViaje)} ({fechaViaje})
                </Text>
              </View>
              <View style={styles.pickerTriggerRight}>
                <Text style={styles.pickerTriggerAction}>Abrir Calendario</Text>
                <ChevronRight size={16} color={THEME.colors.primary} />
              </View>
            </TouchableOpacity>

            {/* Hora de Salida */}
            <Text style={styles.label}>Hora de Salida:</Text>
            <View style={styles.quickHoursRow}>
              {['05:00', '06:00', '07:00', '08:00', '13:00', '15:00', '18:00'].map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[styles.quickHourChip, horaViaje.substring(0, 5) === h && styles.quickHourChipActive]}
                  onPress={() => setHoraViaje(h)}
                >
                  <Text style={[styles.quickHourText, horaViaje.substring(0, 5) === h && styles.quickHourTextActive]}>
                    {h}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.pickerTriggerBox}
              onPress={() => setShowTimePicker(true)}
            >
              <View style={styles.pickerTriggerLeft}>
                <Clock size={18} color={THEME.colors.primary} />
                <Text style={styles.pickerTriggerValue}>
                  {horaViaje.substring(0, 5)} {parseInt(horaViaje.split(':')[0], 10) >= 12 ? 'PM' : 'AM'}
                </Text>
              </View>
              <View style={styles.pickerTriggerRight}>
                <Text style={styles.pickerTriggerAction}>Cambiar Hora</Text>
                <ChevronRight size={16} color={THEME.colors.primary} />
              </View>
            </TouchableOpacity>

            {/* Precio Base */}
            <Text style={styles.label}>Precio por Pasajero (S/):</Text>
            <View style={styles.quickPriceRow}>
              {['40.00', '50.00', '60.00', '70.00'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.quickPriceChip, precioBase === p && styles.quickPriceChipActive]}
                  onPress={() => setPrecioBase(p)}
                >
                  <Text style={[styles.quickPriceText, precioBase === p && styles.quickPriceTextActive]}>
                    S/ {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputBox}>
              <DollarSign size={18} color={THEME.colors.primary} />
              <TextInput
                style={styles.input}
                value={precioBase}
                onChangeText={setPrecioBase}
                keyboardType="decimal-pad"
                placeholder="50.00"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Plus size={18} color="#FFF" />
                  <Text style={styles.submitBtnText}>Publicar Salida</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>

          {/* Calendar Picker Modal */}
          <CalendarModal
            visible={showCalendar}
            selectedDate={fechaViaje}
            onSelectDate={(newDate) => setFechaViaje(newDate)}
            onClose={() => setShowCalendar(false)}
          />

          {/* Time Picker Modal */}
          <TimePickerModal
            visible={showTimePicker}
            selectedTime={horaViaje}
            onSelectTime={(newTime) => setHoraViaje(newTime)}
            onClose={() => setShowTimePicker(false)}
          />
        </View>
      </KeyboardAvoidingView>
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
    marginBottom: 16,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  addRouteToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
  },
  addRouteToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  newRouteBox: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
    gap: 10,
  },
  newRouteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  newRouteTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  newRouteInputGroup: {
    gap: 4,
  },
  inputSubLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  newRouteInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  saveRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 4,
  },
  saveRouteBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginTop: 14,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
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
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  quickDateBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceSubtle,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  quickDateBtnActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  quickDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  quickDateTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  pickerTriggerBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 6,
  },
  pickerTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickerTriggerValue: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  pickerTriggerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pickerTriggerAction: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  quickHoursRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  quickHourChip: {
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  quickHourChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  quickHourText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  quickHourTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  quickPriceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  quickPriceChip: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  quickPriceChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  quickPriceText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  quickPriceTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
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
    marginTop: 22,
    marginBottom: 10,
    ...THEME.shadows.md,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
