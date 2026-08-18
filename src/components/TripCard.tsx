import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { THEME } from '../constants/theme';
import { Viaje } from '../types/database';
import { Calendar, Clock, MapPin, Users, Trash2, Eye } from 'lucide-react-native';

interface TripCardProps {
  viaje: Viaje;
  onViewSeats: (viaje: Viaje) => void;
  onDelete?: (viaje: Viaje) => void;
  isAdmin?: boolean;
}

export const TripCard: React.FC<TripCardProps> = ({
  viaje,
  onViewSeats,
  onDelete,
  isAdmin,
}) => {
  const isCancelled = viaje.estado === 'CANCELADO';
  const isCompleted = viaje.estado === 'COMPLETADO';
  const totalAsientos = viaje.vehiculos?.total_asientos_pasajero || 4;
  const vehiculoNombre = viaje.vehiculos?.nombre_display || `Camioneta (${totalAsientos}P)`;

  return (
    <View style={[styles.card, isCancelled && styles.cardCancelled]}>
      <View style={styles.topRow}>
        <View style={styles.routeHeader}>
          <MapPin size={16} color={THEME.colors.primary} />
          <Text style={styles.routeText}>
            {viaje.rutas?.origen || 'CUSCO'} ➔ {viaje.rutas?.destino || 'QUILLABAMBA'}
          </Text>
        </View>

        <Text style={styles.priceText}>S/ {Number(viaje.precio_base).toFixed(2)}</Text>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Calendar size={13} color={THEME.colors.textMuted} />
          <Text style={styles.detailText}>{viaje.fecha_viaje}</Text>
        </View>

        <View style={styles.detailItem}>
          <Clock size={13} color={THEME.colors.textMuted} />
          <Text style={styles.detailText}>{viaje.hora_viaje}</Text>
        </View>

        <View style={styles.detailItem}>
          <Users size={13} color={THEME.colors.accentDark} />
          <Text style={[styles.detailText, { color: THEME.colors.accentDark, fontWeight: '700' }]}>
            {vehiculoNombre}
          </Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.statusBadge}>
          <Text
            style={[
              styles.statusText,
              isCancelled ? styles.statusCancelled : isCompleted ? styles.statusCompleted : styles.statusActive,
            ]}
          >
            ● {viaje.estado}
          </Text>
        </View>

        <View style={styles.actionsGroup}>
          <TouchableOpacity style={styles.seatBtn} onPress={() => onViewSeats(viaje)}>
            <Eye size={14} color="#FFF" />
            <Text style={styles.seatBtnText}>Ver Asientos</Text>
          </TouchableOpacity>

          {isAdmin && onDelete && (
            <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(viaje)}>
              <Trash2 size={15} color={THEME.colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.sm,
  },
  cardCancelled: {
    opacity: 0.6,
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  routeText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.primary,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: THEME.colors.surfaceSubtle,
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusActive: {
    color: THEME.colors.success,
  },
  statusCompleted: {
    color: THEME.colors.info,
  },
  statusCancelled: {
    color: THEME.colors.danger,
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  seatBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: THEME.colors.dangerLight,
    padding: 7,
    borderRadius: 8,
  },
});
