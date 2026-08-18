import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { THEME } from '../constants/theme';
import { Viaje, Venta } from '../types/database';
import { supabase } from '../lib/supabase';
import { X, UserCheck, Armchair } from 'lucide-react-native';

interface SeatMapModalProps {
  visible: boolean;
  viaje: Viaje | null;
  onClose: () => void;
}

interface SeatInfo {
  numero: number;
  estado: 'DISPONIBLE' | 'BLOQUEADO' | 'PAGADO';
  pasajero?: {
    nombres: string;
    apellidos: string;
    documento: string;
    telefono: string;
    monto: number;
  };
}

export const SeatMapModal: React.FC<SeatMapModalProps> = ({
  visible,
  viaje,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [seats, setSeats] = useState<SeatInfo[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<SeatInfo | null>(null);

  useEffect(() => {
    if (visible && viaje) {
      loadSeatStatuses();
    } else {
      setSelectedSeat(null);
    }
  }, [visible, viaje]);

  const loadSeatStatuses = async () => {
    if (!viaje) return;
    setLoading(true);

    try {
      const totalAsientos = viaje.vehiculos?.total_asientos_pasajero || 4;

      // 1. Obtener ventas confirmadas
      const { data: ventas } = await supabase
        .from('ventas')
        .select('*')
        .eq('viaje_id', viaje.id);

      // 2. Obtener bloqueos activos
      const { data: bloqueos } = await supabase
        .from('asientos_bloqueos')
        .select('*')
        .eq('viaje_id', viaje.id);

      const computedSeats: SeatInfo[] = [];

      for (let i = 1; i <= totalAsientos; i++) {
        const venta = ventas?.find((v: Venta) => v.numero_asiento === i && !v.culqi_charge_id?.startsWith('RECHAZADO_'));
        const bloqueo = bloqueos?.find((b: any) => b.numero_asiento === i);

        if (venta) {
          computedSeats.push({
            numero: i,
            estado: 'PAGADO',
            pasajero: {
              nombres: venta.nombres,
              apellidos: venta.apellidos,
              documento: `${venta.tipo_documento} ${venta.nro_documento}`,
              telefono: venta.telefono,
              monto: Number(venta.monto_pagado),
            },
          });
        } else if (bloqueo && new Date(bloqueo.expira_at) > new Date()) {
          computedSeats.push({
            numero: i,
            estado: 'BLOQUEADO',
          });
        } else {
          computedSeats.push({
            numero: i,
            estado: 'DISPONIBLE',
          });
        }
      }

      setSeats(computedSeats);
    } catch (e) {
      console.error('Error cargando asientos:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!viaje) return null;

  const totalSeats = viaje.vehiculos?.total_asientos_pasajero || 4;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Mapa de Asientos</Text>
              <Text style={styles.subtitle}>
                {viaje.rutas?.origen || 'Cusco'} ➔ {viaje.rutas?.destino || 'Quillabamba'} ({viaje.fecha_viaje} {viaje.hora_viaje})
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={THEME.colors.primary} style={{ marginVertical: 40 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Legend */}
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: THEME.colors.seatAvailable }]} />
                  <Text style={styles.legendText}>Libre</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: THEME.colors.seatBlocked }]} />
                  <Text style={styles.legendText}>En Proceso</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: THEME.colors.seatSold }]} />
                  <Text style={styles.legendText}>Vendido</Text>
                </View>
              </View>

              {/* Van Representation */}
              <View style={styles.vanContainer}>
                {/* Windshield */}
                <View style={styles.windshield}>
                  <Text style={styles.windshieldText}>PARABRISAS FRONTAL</Text>
                </View>

                {/* Driver and Seat 1 (Copilot) */}
                <View style={styles.seatRow}>
                  <View style={[styles.seatBox, styles.driverBox]}>
                    <Text style={styles.driverText}>🪑 Chofer</Text>
                  </View>

                  {seats[0] && (
                    <TouchableOpacity
                      style={[
                        styles.seatBox,
                        seats[0].estado === 'PAGADO' && styles.seatSold,
                        seats[0].estado === 'BLOQUEADO' && styles.seatBlocked,
                        seats[0].estado === 'DISPONIBLE' && styles.seatAvailable,
                        selectedSeat?.numero === 1 && styles.seatHighlight,
                      ]}
                      onPress={() => setSelectedSeat(seats[0])}
                    >
                      <Armchair size={16} color="#FFF" />
                      <Text style={styles.seatNumText}>#1 Copiloto</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Row 2 (Seats 2 & 3) */}
                <View style={styles.seatRow}>
                  {seats[1] && (
                    <TouchableOpacity
                      style={[
                        styles.seatBox,
                        seats[1].estado === 'PAGADO' && styles.seatSold,
                        seats[1].estado === 'BLOQUEADO' && styles.seatBlocked,
                        seats[1].estado === 'DISPONIBLE' && styles.seatAvailable,
                        selectedSeat?.numero === 2 && styles.seatHighlight,
                      ]}
                      onPress={() => setSelectedSeat(seats[1])}
                    >
                      <Armchair size={16} color="#FFF" />
                      <Text style={styles.seatNumText}>#2 Izq</Text>
                    </TouchableOpacity>
                  )}

                  {seats[2] && (
                    <TouchableOpacity
                      style={[
                        styles.seatBox,
                        seats[2].estado === 'PAGADO' && styles.seatSold,
                        seats[2].estado === 'BLOQUEADO' && styles.seatBlocked,
                        seats[2].estado === 'DISPONIBLE' && styles.seatAvailable,
                        selectedSeat?.numero === 3 && styles.seatHighlight,
                      ]}
                      onPress={() => setSelectedSeat(seats[2])}
                    >
                      <Armchair size={16} color="#FFF" />
                      <Text style={styles.seatNumText}>#3 Der</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Row 3 (Seat 4 or Seats 4, 5, 6) */}
                <View style={styles.seatRow}>
                  {seats[3] && (
                    <TouchableOpacity
                      style={[
                        styles.seatBox,
                        seats[3].estado === 'PAGADO' && styles.seatSold,
                        seats[3].estado === 'BLOQUEADO' && styles.seatBlocked,
                        seats[3].estado === 'DISPONIBLE' && styles.seatAvailable,
                        selectedSeat?.numero === 4 && styles.seatHighlight,
                      ]}
                      onPress={() => setSelectedSeat(seats[3])}
                    >
                      <Armchair size={16} color="#FFF" />
                      <Text style={styles.seatNumText}>#4 {totalSeats === 4 ? 'Atrás' : 'Izq'}</Text>
                    </TouchableOpacity>
                  )}

                  {totalSeats > 4 && seats[4] && (
                    <TouchableOpacity
                      style={[
                        styles.seatBox,
                        seats[4].estado === 'PAGADO' && styles.seatSold,
                        seats[4].estado === 'BLOQUEADO' && styles.seatBlocked,
                        seats[4].estado === 'DISPONIBLE' && styles.seatAvailable,
                        selectedSeat?.numero === 5 && styles.seatHighlight,
                      ]}
                      onPress={() => setSelectedSeat(seats[4])}
                    >
                      <Armchair size={16} color="#FFF" />
                      <Text style={styles.seatNumText}>#5 Cen</Text>
                    </TouchableOpacity>
                  )}

                  {totalSeats > 5 && seats[5] && (
                    <TouchableOpacity
                      style={[
                        styles.seatBox,
                        seats[5].estado === 'PAGADO' && styles.seatSold,
                        seats[5].estado === 'BLOQUEADO' && styles.seatBlocked,
                        seats[5].estado === 'DISPONIBLE' && styles.seatAvailable,
                        selectedSeat?.numero === 6 && styles.seatHighlight,
                      ]}
                      onPress={() => setSelectedSeat(seats[5])}
                    >
                      <Armchair size={16} color="#FFF" />
                      <Text style={styles.seatNumText}>#6 Der</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Selected Seat Details */}
              {selectedSeat && (
                <View style={styles.detailBox}>
                  <View style={styles.detailHeader}>
                    <UserCheck size={16} color={THEME.colors.primary} />
                    <Text style={styles.detailTitle}>
                      Detalle de Asiento #{selectedSeat.numero} ({selectedSeat.estado})
                    </Text>
                  </View>

                  {selectedSeat.pasajero ? (
                    <View style={styles.passengerDetails}>
                      <Text style={styles.detailTextBold}>
                        {selectedSeat.pasajero.nombres} {selectedSeat.pasajero.apellidos}
                      </Text>
                      <Text style={styles.detailText}>Doc: {selectedSeat.pasajero.documento}</Text>
                      <Text style={styles.detailText}>Teléfono: {selectedSeat.pasajero.telefono}</Text>
                      <Text style={styles.detailText}>Monto: S/ {selectedSeat.pasajero.monto.toFixed(2)}</Text>
                    </View>
                  ) : (
                    <Text style={styles.detailTextEmpty}>
                      {selectedSeat.estado === 'DISPONIBLE'
                        ? 'Este asiento está disponible para venta.'
                        : 'Asiento en proceso de compra temporal.'}
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>
          )}
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
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  vanContainer: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    marginBottom: 16,
  },
  windshield: {
    backgroundColor: '#CBD5E1',
    padding: 6,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 14,
  },
  windshieldText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 1,
  },
  seatRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  seatBox: {
    flex: 1,
    marginHorizontal: 6,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  driverBox: {
    backgroundColor: '#94A3B8',
  },
  driverText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  seatAvailable: {
    backgroundColor: THEME.colors.seatAvailable,
  },
  seatBlocked: {
    backgroundColor: THEME.colors.seatBlocked,
  },
  seatSold: {
    backgroundColor: THEME.colors.seatSold,
  },
  seatHighlight: {
    borderWidth: 3,
    borderColor: THEME.colors.accent,
  },
  seatNumText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  detailBox: {
    backgroundColor: THEME.colors.primarySoft,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  detailTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  passengerDetails: {
    gap: 4,
  },
  detailTextBold: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  detailText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  detailTextEmpty: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontStyle: 'italic',
  },
});
