import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { THEME } from '../constants/theme';
import { Header } from '../components/Header';
import { TripCard } from '../components/TripCard';
import { SeatMapModal } from '../components/SeatMapModal';
import { CreateTripModal } from '../components/CreateTripModal';
import { CalendarModal } from '../components/CalendarModal';
import { supabase } from '../lib/supabase';
import { Viaje } from '../types/database';
import { useAuth } from '../context/AuthContext';
import { getPeruTodayString, getPeruTomorrowString, formatPeruDateDisplay } from '../utils/dateHelper';
import { Plus, Calendar, Search, X, MapPin } from 'lucide-react-native';

export const TripsScreen: React.FC = () => {
  const { isAdmin, isEmpleado, isVendedor } = useAuth();
  const canManageTrips = isAdmin || isEmpleado || isVendedor;

  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState<'ALL' | 'TODAY' | 'TOMORROW' | 'CUSTOM'>('ALL');
  const [selectedCustomDate, setSelectedCustomDate] = useState<string>('');
  const [showFilterCalendar, setShowFilterCalendar] = useState(false);
  const [selectedRouteFilter, setSelectedRouteFilter] = useState<string>('ALL');

  // Modals
  const [selectedSeatViaje, setSelectedSeatViaje] = useState<Viaje | null>(null);
  const [isSeatModalOpen, setIsSeatModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadTrips = async (customDateToFetch?: string) => {
    try {
      const today = getPeruTodayString();
      let query = supabase
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
        .order('fecha_viaje', { ascending: true })
        .order('hora_viaje', { ascending: true });

      // Si se pide una fecha específica antes de hoy, no limitar con gte
      if (customDateToFetch && customDateToFetch < today) {
        query = query.gte('fecha_viaje', customDateToFetch);
      } else {
        query = query.gte('fecha_viaje', today);
      }

      const { data, error } = await query;

      if (error) throw error;
      setViajes((data as any) || []);
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
    loadTrips(selectedCustomDate);
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

              loadTrips(selectedCustomDate);
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
    // 1. Date Filter
    if (filterDate === 'TODAY' && v.fecha_viaje !== todayStr) return false;
    if (filterDate === 'TOMORROW' && v.fecha_viaje !== tomorrowStr) return false;
    if (filterDate === 'CUSTOM' && selectedCustomDate && v.fecha_viaje !== selectedCustomDate) return false;

    // 2. Route Filter
    if (selectedRouteFilter !== 'ALL') {
      const rStr = `${v.rutas?.origen || 'CUSCO'} ➔ ${v.rutas?.destino || 'QUILLABAMBA'}`;
      if (rStr !== selectedRouteFilter) return false;
    }

    // 3. Search Query (Route, Time, Vehicle)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchRoute = `${v.rutas?.origen || ''} ${v.rutas?.destino || ''}`.toLowerCase().includes(q);
      const matchVehicle = v.vehiculos?.nombre_display?.toLowerCase().includes(q);
      const matchHour = v.hora_viaje?.includes(q);
      const matchDate = v.fecha_viaje?.includes(q);
      if (!matchRoute && !matchVehicle && !matchHour && !matchDate) return false;
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

      {/* Action and Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBox}>
          <Search size={16} color={THEME.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar por ruta, hora, auto..."
            placeholderTextColor={THEME.colors.textMuted}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {canManageTrips && (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => setIsCreateModalOpen(true)}
          >
            <Plus size={16} color="#FFF" />
            <Text style={styles.createBtnText}>Nueva Salida</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Date Filter Chips with Calendar Trigger */}
      <View style={styles.filterScrollWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
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

          {/* Calendar Picker Filter Chip */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              styles.calendarFilterChip,
              filterDate === 'CUSTOM' && styles.filterChipActive,
            ]}
            onPress={() => setShowFilterCalendar(true)}
          >
            <Calendar size={13} color={filterDate === 'CUSTOM' ? '#FFF' : THEME.colors.primary} />
            <Text
              style={[
                styles.filterChipText,
                filterDate === 'CUSTOM' ? styles.textWhite : { color: THEME.colors.primary },
              ]}
            >
              {filterDate === 'CUSTOM' && selectedCustomDate
                ? `📅 ${formatPeruDateDisplay(selectedCustomDate)}`
                : '📅 Elegir Fecha'}
            </Text>
            {filterDate === 'CUSTOM' && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation?.();
                  setFilterDate('ALL');
                  setSelectedCustomDate('');
                  loadTrips();
                }}
                style={styles.clearDateBtn}
              >
                <X size={12} color="#FFF" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Routes Horizontal Filter */}
      {uniqueRoutes.length > 1 && (
        <View style={styles.routesScrollWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.routesRow}
          >
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
          </ScrollView>
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
              isAdmin={canManageTrips}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No hay salidas encontradas</Text>
              <Text style={styles.emptyText}>
                No se encontraron salidas programadas para la fecha o filtros seleccionados.
              </Text>
              {canManageTrips && (
                <TouchableOpacity
                  style={styles.emptyCreateBtn}
                  onPress={() => setIsCreateModalOpen(true)}
                >
                  <Plus size={14} color="#FFF" />
                  <Text style={styles.emptyCreateBtnText}>Programar Nueva Salida</Text>
                </TouchableOpacity>
              )}
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
        onTripCreated={() => loadTrips(selectedCustomDate)}
      />

      {/* Date Filter Calendar Modal */}
      <CalendarModal
        visible={showFilterCalendar}
        selectedDate={selectedCustomDate || todayStr}
        minDate=""
        onSelectDate={(newDate) => {
          setSelectedCustomDate(newDate);
          setFilterDate('CUSTOM');
          loadTrips(newDate);
        }}
        onClose={() => setShowFilterCalendar(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.textPrimary,
    paddingVertical: 0,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    ...THEME.shadows.sm,
  },
  createBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  filterScrollWrapper: {
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  calendarFilterChip: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.surfaceSubtle,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  clearDateBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    padding: 2,
    marginLeft: 2,
  },
  routesScrollWrapper: {
    backgroundColor: THEME.colors.surface,
    paddingBottom: 6,
  },
  routesRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
  },
  routePill: {
    backgroundColor: THEME.colors.surfaceSubtle,
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
    paddingTop: 10,
    paddingBottom: 30,
  },
  emptyBox: {
    padding: 36,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  emptyText: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  emptyCreateBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
});

