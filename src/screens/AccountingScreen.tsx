import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { THEME } from '../constants/theme';
import { Header } from '../components/Header';
import { supabase } from '../lib/supabase';
import { Venta } from '../types/database';
import { FileSpreadsheet, Calculator, DollarSign, ArrowUpRight, ShieldCheck } from 'lucide-react-native';

export const AccountingScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  );

  const [totalVentas, setTotalVentas] = useState(0);
  const [ventasExoneradas, setVentasExoneradas] = useState(0);
  const [ventasGravadas, setVentasGravadas] = useState(0);
  const [rentaCalculada, setRentaCalculada] = useState(0);
  const [totalComprobantesCount, setTotalComprobantesCount] = useState(0);

  const loadAccountingData = async () => {
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01T00:00:00Z`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month}-${lastDay}T23:59:59Z`;

      const { data, error } = await supabase
        .from('ventas')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .eq('comprobante_emitido', true);

      if (error) throw error;

      const sales: Venta[] = data || [];
      setTotalComprobantesCount(sales.length);

      let sumTotal = 0;
      sales.forEach((v) => {
        sumTotal += Number(v.monto_pagado || 0);
      });

      setTotalVentas(sumTotal);
      // En transporte terrestre de pasajeros el 100% es exonerado de IGV (Ley 27037 / 27265)
      setVentasExoneradas(sumTotal);
      setVentasGravadas(0);

      // Impuesto a la Renta MIPE Tributario: 1.0% de Ingresos Netos
      const renta = sumTotal * 0.01;
      setRentaCalculada(renta);
    } catch (e) {
      console.error('Error cargando contabilidad:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAccountingData();
  }, [selectedMonth]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAccountingData();
  };

  return (
    <View style={styles.container}>
      <Header
        title="Reporte Contable y Tributario"
        subtitle={`Liquidación ${selectedMonth} (SUNAT)`}
        onRefresh={onRefresh}
        isRefreshing={refreshing}
      />

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
          <Text style={styles.loadingText}>Calculando balances tributarios...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Company Card */}
          <View style={styles.companyCard}>
            <Text style={styles.companyTitle}>INVERSIONES TUNKY CHASKY S.R.L.</Text>
            <Text style={styles.companyRuc}>RUC: 20613271701</Text>
            <View style={styles.regimeBadge}>
              <ShieldCheck size={12} color="#047857" />
              <Text style={styles.regimeText}>Régimen MIPE Tributario • Exonerado IGV Pasajes</Text>
            </View>
          </View>

          {/* Tax Summary Cards */}
          <Text style={styles.sectionTitle}>Liquidación Mensual de Impuestos</Text>

          {/* Card 1: Ingresos Brutos */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>Total Ingresos del Mes</Text>
                <Text style={styles.summarySub}>{totalComprobantesCount} Comprobantes Emitidos</Text>
              </View>
              <Text style={styles.summaryValue}>S/ {totalVentas.toFixed(2)}</Text>
            </View>
          </View>

          {/* Card 2: IGV */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>IGV por Pagar (0%)</Text>
                <Text style={styles.summarySub}>Ventas Exoneradas de Pasajeros</Text>
              </View>
              <Text style={[styles.summaryValue, { color: THEME.colors.success }]}>S/ 0.00</Text>
            </View>
          </View>

          {/* Card 3: Impuesto a la Renta */}
          <View style={[styles.summaryCard, { borderLeftColor: THEME.colors.primary, borderLeftWidth: 4 }]}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>Pago a Cuenta Renta (1.0%)</Text>
                <Text style={styles.summarySub}>Tasa MIPE sobre ingresos netos</Text>
              </View>
              <Text style={[styles.summaryValue, { color: THEME.colors.primary }]}>
                S/ {rentaCalculada.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Informative Note */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>📌 Base Legal Aplicable:</Text>
            <Text style={styles.infoText}>
              • Transporte terrestre nacional de pasajeros se encuentra exonerado de IGV (Apéndice II del TUO de la Ley del IGV).
            </Text>
            <Text style={styles.infoText}>
              • La tasa mensual del Pago a Cuenta del Impuesto a la Renta para el Régimen MIPE Tributario es del 1.0% de los ingresos netos.
            </Text>
          </View>
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
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  companyCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
    ...THEME.shadows.sm,
  },
  companyTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: THEME.colors.primary,
  },
  companyRuc: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  regimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  regimeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 10,
  },
  summaryCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 10,
    ...THEME.shadows.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  summarySub: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
  },
  infoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
    gap: 6,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  infoText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
});
