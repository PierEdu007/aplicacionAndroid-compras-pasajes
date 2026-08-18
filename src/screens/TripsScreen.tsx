import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { THEME } from '../constants/theme';
import { Header } from '../components/Header';
import { TripCard } from '../components/TripCard';
import { SeatMapModal } from '../components/SeatMapModal';
import { CreateTripModal } from '../components/CreateTripModal';
import { supabase } from '../lib/supabase';
import { Viaje } from '../types/database';
import { useAuth } from '../context/AuthContext';
import { getPeruTodayString, getPeruTomorrowString, formatPeruDateDisplay } from '../utils/dateHelper';
import { Plus, Calendar, Filter } from 'lucide-react-native';

export const TripsScreen: React.FC = () => {
  const { isAdmin } = useAuth();
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterDate, setFilterDate] = useState<'ALL' | 'TODAY' | 'TOMORROW'>('ALL');
  const [selectedRouteFilter, setSelectedRouteFilter] = useState<string>('ALL');

  // Modals
  const [selectedSeatViaje, setSelectedSeatViaje] = useState<Viaje | null>(null);
  const [isSeatModalOpen, setIsSeatModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
          created_at,
          rutas (origen, destino),
          vehiculos (nombre_display, total_asientos_pasajero, tipo)
        `)
        .gte('fecha_viaje', today)
        .order('fecha_viaje', { ascending: true })
        .order('hora_viaje', { ascending: true });

      if (error) throw error;
      setViajes(data || []);
    } catch (e: any) {
      console.error('Error cargando viajes:', e);
      Alert.alert('Error', 'No se pudieron cargar los viajes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTrips();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadTrips();
  };

  const handleOpenSeatMap = (viaje: Viaje) => {
    setSelectedSeatViaje(viaje);
    setIsSeatModalOpen(true);
  };

  const handleDeleteTrip = (viaje: Viaje) => {
    Alert.alert(
      'Eliminar Salida',
      `¿Deseas eliminar la salida ${viaje.rutas?.origen} ➔ ${viaje.rutas?.destino} del ${viaje.fecha_viaje} a las ${viaje.hora_viaje}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              // 1. Eliminar bloqueos
              await supabase.from('asientos_bloqueos').delete().eq('viaje_id', viaje.id);

              // 2. Intentar eliminar viaje
              const { error } = await supabase.from('viajes').delete().eq('id', viaje.id);

              if (error) {
                // Si tiene ventas registradas, cambiar estado a CANCELADO
                await supabase.from('viajes').update({ estado: 'CANCELADO' }).eq('id', viaje.id);
                Alert.alert('Aviso', 'El viaje tenía reservas y fue marcado como CANCELADO.');
              } else {
                Alert.alert('Éxito', 'Salida eliminada con éxito.');
              }

              loadTrips();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo eliminar el viaje.');
            }
          },
        },
      ]
    );
  };

  const todayStr = getPeruTodayString();
  const tomorrowStr = getPeruTomorrowString();

  const uniqueRoutes = Array.from(
    new Set(viajes.map((v) => `${v.rutas?.origen || 'CUSCO'} ➔ ${v.rutas?.destino || 'QUILLABAMBA'}`))
  );

  const filteredTrips = viajes.filter((v) => {
    if (filterDate === 'TODAY' && v.fecha_viaje !== todayStr) return false;
    if (filterDate === 'TOMORROW' && v.fecha_viaje !== tomorrowStr) return false;

    if (selectedRouteFilter !== 'ALL') {
      const rStr = `${v.rutas?.origen || 'CUSCO'} ➔ ${v.rutas?.destino || 'QUILLABAMBA'}`;
      if (rStr !== selectedRouteFilter) return false;
    }

    return true;
  });

  return (
    <View style={styles.container}>
      <Header
        title="Gestión de Salidas"
        subtitle={`${filteredTrips.length} salidas programadas`}
        onRefresh={onRefresh}
        isRefreshing={refreshing}
      />

      {/* Action and Filter Bar */}
      <View style={styles.topBar}>
        <View style={styles.filterChipsRow}>
          <TouchableOpacity
            style={[styles.filterChip, filterDate === 'ALL' && styles.filterChipActive]}
            onPress={() => setFilterDate('ALL')}
          >
            <Text style={[styles.filterChipText, filterDate === 'ALL' && styles.textWhite]}>
              Todas ({viajes.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterDate === 'TODAY' && styles.filterChipActive]}
            onPress={() => setFilterDate('TODAY')}
          >
            <Text style={[styles.filterChipText, filterDate === 'TODAY' && styles.textWhite]}>
              Hoy ({formatPeruDateDisplay(todayStr).substring(0, 5)})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterDate === 'TOMORROW' && styles.filterChipActive]}
            onPress={() => setFilterDate('TOMORROW')}
          >
            <Text style={[styles.filterChipText, filterDate === 'TOMORROW' && styles.textWhite]}>
              Mañana ({formatPeruDateDisplay(tomorrowStr).substring(0, 5)})
            </Text>
          </TouchableOpacity>
        </View>

        {isAdmin && (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => setIsCreateModalOpen(true)}
          >
            <Plus size={16} color="#FFF" />
            <Text style={styles.createBtnText}>Nueva Salida</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Routes Horizontal Filter */}
      {uniqueRoutes.length > 1 && (
        <View style={styles.routesRow}>
          <TouchableOpacity
            style={[styles.routePill, selectedRouteFilter === 'ALL' && styles.routePillActive]}
            onPress={() => setSelectedRouteFilter('ALL')}
          >
            <Text style={[styles.routePillText, selectedRouteFilter === 'ALL' && styles.textWhite]}>
              Todas las rutas
            </Text>
          </TouchableOpacity>

          {uniqueRoutes.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.routePill, selectedRouteFilter === r && styles.routePillActive]}
              onPress={() => setSelectedRouteFilter(r)}
            >
              <Text style={[styles.routePillText, selectedRouteFilter === r && styles.textWhite]}>
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Trips List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
          <Text style={styles.loadingText}>Cargando programación de viajes...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTrips}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TripCard
              viaje={item}
              onViewSeats={handleOpenSeatMap}
              onDelete={handleDeleteTrip}
              isAdmin={isAdmin}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No hay salidas programadas para esta fecha o filtro.</Text>
            </View>
          }
        />
      )}

      {/* Modals */}
      <SeatMapModal
        visible={isSeatModalOpen}
        viaje={selectedSeatViaje}
        onClose={() => {
          setIsSeatModalOpen(false);
          setSelectedSeatViaje(null);
        }}
      />

      <CreateTripModal
        visible={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTripCreated={loadTrips}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  routesRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 6,
    flexWrap: 'wrap',
  },
  routePill: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  routePillActive: {
    backgroundColor: THEME.colors.accentDark,
    borderColor: THEME.colors.accentDark,
  },
  routePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  textWhite: {
    color: '#FFF',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    ...THEME.shadows.sm,
  },
  createBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 30,
  },
  emptyBox: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: THEME.colors.textMuted,
    fontSize: 13,
  },
});
