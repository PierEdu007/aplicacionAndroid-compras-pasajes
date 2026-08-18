import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { THEME } from '../constants/theme';
import { Ruta, Vehiculo } from '../types/database';
import { supabase } from '../lib/supabase';
import { X, Plus, Calendar, Clock, DollarSign } from 'lucide-react-native';

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
  const [fechaViaje, setFechaViaje] = useState(new Date().toISOString().split('T')[0]);
  const [horaViaje, setHoraViaje] = useState('07:00');
  const [precioBase, setPrecioBase] = useState('50.00');

  useEffect(() => {
    if (visible) {
      loadFormData();
    }
  }, [visible]);

  const loadFormData = async () => {
    try {
      const { data: rData } = await supabase.from('rutas').select('*').eq('activa', true);
      const { data: vData } = await supabase.from('vehiculos').select('*').eq('activo', true);

      if (rData && rData.length > 0) {
        setRutas(rData);
        setSelectedRutaId(rData[0].id);
      }
      if (vData && vData.length > 0) {
        setVehiculos(vData);
        setSelectedVehiculoId(vData[0].id);
      }
    } catch (e) {
      console.error('Error cargando rutas/vehículos:', e);
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

      Alert.alert('Éxito', '¡Viaje(s) programado(s) exitosamente!');
      onTripCreated();
      onClose();
    } catch (err: any) {
      console.error('Error creando viaje:', err);
      Alert.alert('Error al crear viaje', err.message || 'No se pudo registrar la salida.');
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
              <Text style={styles.title}>Programar Nueva Salida</Text>
              <Text style={styles.subtitle}>Crea un viaje disponible para reserva</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Ruta Selector */}
            <Text style={styles.label}>Ruta de Viaje:</Text>
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

            {/* Fecha */}
            <Text style={styles.label}>Fecha (YYYY-MM-DD):</Text>
            <View style={styles.inputBox}>
              <Calendar size={18} color={THEME.colors.primary} />
              <TextInput
                style={styles.input}
                value={fechaViaje}
                onChangeText={setFechaViaje}
                placeholder="2026-08-18"
              />
            </View>

            {/* Hora */}
            <Text style={styles.label}>Hora de Salida (HH:MM):</Text>
            <View style={styles.inputBox}>
              <Clock size={18} color={THEME.colors.primary} />
              <TextInput
                style={styles.input}
                value={horaViaje}
                onChangeText={setHoraViaje}
                placeholder="07:00"
              />
            </View>

            {/* Precio Base */}
            <Text style={styles.label}>Precio por Pasajero (S/):</Text>
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
    maxHeight: '90%',
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
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginTop: 12,
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
    marginTop: 20,
    marginBottom: 10,
    ...THEME.shadows.md,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
