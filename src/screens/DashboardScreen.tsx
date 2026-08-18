import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { THEME } from '../constants/theme';
import { Header } from '../components/Header';
import { supabase } from '../lib/supabase';
import { Venta } from '../types/database';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  ShoppingBag,
  ArrowRight,
  Armchair,
} from 'lucide-react-native';

interface DashboardScreenProps {
  onNavigateToSales: () => void;
  onNavigateToTrips: () => void;
  onOpenDirectSale: () => void;
  onOpenCreateTrip: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigateToSales,
  onNavigateToTrips,
  onOpenDirectSale,
  onOpenCreateTrip,
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Counters
  const [totalRevenueToday, setTotalRevenueToday] = useState(0);
  const [confirmedSalesCount, setConfirmedSalesCount] = useState(0);
  const [pendingYapeCount, setPendingYapeCount] = useState(0);
  const [activeTripsCount, setActiveTripsCount] = useState(0);
  const [recentSales, setRecentSales] = useState<Venta[]>([]);

  const loadDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Fetch Ventas
      const { data: salesData } = await supabase
        .from('ventas')
        .select(`*, viajes (fecha_viaje, hora_viaje, rutas (origen, destino))`)
        .order('created_at', { ascending: false });

      if (salesData) {
        const validSales = salesData.filter((v: Venta) => !v.culqi_charge_id?.startsWith('RECHAZADO_'));
        
        // Ventas confirmadas hoy
        const todaySales = validSales.filter((v: Venta) => {
          const isToday = v.created_at?.startsWith(today) || v.viajes?.fecha_viaje === today;
          return isToday && (v.comprobante_emitido || v.estado === 'CONFIRMADO');
        });

        const revenue = todaySales.reduce((acc: number, curr: Venta) => acc + Number(curr.monto_pagado || 0), 0);
        setTotalRevenueToday(revenue);

        const confirmed = validSales.filter((v: Venta) => v.comprobante_emitido || v.estado === 'CONFIRMADO');
        setConfirmedSalesCount(confirmed.length);

        const pending = validSales.filter(
          (v: Venta) => !v.comprobante_emitido && v.estado !== 'CONFIRMADO' && v.estado !== 'RECHAZADO'
        );
        setPendingYapeCount(pending.length);

        setRecentSales(validSales.slice(0, 5));
      }

      // 2. Fetch Viajes Activos
      const { data: tripsData } = await supabase
        .from('viajes')
        .select('id')
        .eq('estado', 'ACTIVO')
        .gte('fecha_viaje', today);

      if (tripsData) {
        setActiveTripsCount(tripsData.length);
      }
    } catch (e) {
      console.error('Error cargando dashboard:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  return (
    <View style={styles.container}>
      <Header
        title="Dashboard General"
        subtitle="Métricas operativas en tiempo real"
        onRefresh={onRefresh}
        isRefreshing={refreshing}
      />

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
          <Text style={styles.loadingText}>Cargando información del sistema...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Quick Action Banner */}
          <View style={styles.quickActionCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickActionTitle}>Venta de Pasajes en Agencia</Text>
              <Text style={styles.quickActionDesc}>
                Emite boletos para pasajeros que compran en mostrador
              </Text>
            </View>
            <TouchableOpacity style={styles.quickActionBtn} onPress={onOpenDirectSale}>
              <ShoppingBag size={16} color="#FFF" />
              <Text style={styles.quickActionBtnText}>Vender</Text>
            </TouchableOpacity>
          </View>

          {/* Metrics Grid */}
          <Text style={styles.sectionTitle}>Métricas del Día</Text>
          <View style={styles.metricsGrid}>
            {/* Card 1: Ingresos */}
            <View style={[styles.metricCard, { borderLeftColor: THEME.colors.primary }]}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>Ingresos Hoy</Text>
                <TrendingUp size={16} color={THEME.colors.primary} />
              </View>
              <Text style={styles.metricValue}>S/ {totalRevenueToday.toFixed(2)}</Text>
            </View>

            {/* Card 2: Yape Pendientes */}
            <TouchableOpacity
              style={[
                styles.metricCard,
                { borderLeftColor: pendingYapeCount > 0 ? THEME.colors.warning : THEME.colors.success },
              ]}
              onPress={onNavigateToSales}
            >
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>Yape por Verificar</Text>
                <Clock
                  size={16}
                  color={pendingYapeCount > 0 ? THEME.colors.warning : THEME.colors.success}
                />
              </View>
              <Text
                style={[
                  styles.metricValue,
                  { color: pendingYapeCount > 0 ? THEME.colors.warning : THEME.colors.success },
                ]}
              >
                {pendingYapeCount}
              </Text>
            </TouchableOpacity>

            {/* Card 3: Boletos Emitidos */}
            <View style={[styles.metricCard, { borderLeftColor: THEME.colors.accent }]}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>Boletos Confirmados</Text>
                <CheckCircle2 size={16} color={THEME.colors.accent} />
              </View>
              <Text style={styles.metricValue}>{confirmedSalesCount}</Text>
            </View>

            {/* Card 4: Salidas Activas */}
            <TouchableOpacity
              style={[styles.metricCard, { borderLeftColor: '#6366F1' }]}
              onPress={onNavigateToTrips}
            >
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>Viajes Activos</Text>
                <Armchair size={16} color="#6366F1" />
              </View>
              <Text style={styles.metricValue}>{activeTripsCount}</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Shortcuts */}
          <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
          <View style={styles.shortcutsRow}>
            <TouchableOpacity style={styles.shortcutBtn} onPress={onOpenCreateTrip}>
              <PlusCircle size={16} color={THEME.colors.primary} />
              <Text style={styles.shortcutBtnText}>Programar Salida</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shortcutBtn} onPress={onNavigateToSales}>
              <AlertCircle size={16} color={THEME.colors.accentDark} />
              <Text style={[styles.shortcutBtnText, { color: THEME.colors.accentDark }]}>
                Revisar Ventas
              </Text>
            </TouchableOpacity>
          </View>

          {/* Recent Sales Section */}
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>Últimas Ventas Registradas</Text>
            <TouchableOpacity onPress={onNavigateToSales}>
              <Text style={styles.viewAllText}>Ver todas</Text>
            </TouchableOpacity>
          </View>

          {recentSales.map((v) => (
            <View key={v.id} style={styles.recentItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recentName}>
                  {v.nombres} {v.apellidos}
                </Text>
                <Text style={styles.recentSub}>
                  {v.viajes?.rutas?.origen || 'CUSCO'} ➔ {v.viajes?.rutas?.destino || 'QUILLABAMBA'} • Asiento #{v.numero_asiento}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.recentAmount}>S/ {Number(v.monto_pagado).toFixed(2)}</Text>
                <Text
                  style={[
                    styles.recentStatus,
                    v.comprobante_emitido ? styles.textSuccess : styles.textWarning,
                  ]}
                >
                  {v.comprobante_emitido ? 'CONFIRMADO' : 'PENDIENTE'}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
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
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.lg,
    padding: 16,
    marginBottom: 18,
    ...THEME.shadows.md,
  },
  quickActionTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  quickActionDesc: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginTop: 2,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  quickActionBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  metricCard: {
    width: '48%',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderLeftWidth: 4,
    ...THEME.shadows.sm,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  shortcutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    ...THEME.shadows.sm,
  },
  shortcutBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.accentDark,
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  recentName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  recentSub: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  recentAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  recentStatus: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  textSuccess: {
    color: THEME.colors.success,
  },
  textWarning: {
    color: THEME.colors.warning,
  },
});
