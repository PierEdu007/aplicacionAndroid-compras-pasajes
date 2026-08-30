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
  Linking,
  ScrollView,
} from 'react-native';
import { THEME } from '../constants/theme';
import { Header } from '../components/Header';
import { SaleCard } from '../components/SaleCard';
import { supabase } from '../lib/supabase';
import { Venta } from '../types/database';
import { emitirComprobanteSunat } from '../services/sunatService';
import { sendConfirmationEmail } from '../services/emailService';
import { Search, Filter, Plus, Calendar, X } from 'lucide-react-native';
import { CalendarModal } from '../components/CalendarModal';
import { getPeruTodayString, formatPeruDateDisplay } from '../utils/dateHelper';

interface SalesScreenProps {
  onOpenDirectSale: () => void;
}

export const SalesScreen: React.FC<SalesScreenProps> = ({ onOpenDirectSale }) => {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'ESPECIAL'>('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [showDateCalendar, setShowDateCalendar] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadSales = async () => {
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select(`*, viajes (fecha_viaje, hora_viaje, rutas (origen, destino))`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVentas(data || []);
    } catch (e: any) {
      console.error('Error cargando ventas:', e);
      Alert.alert('Error', 'No se pudieron cargar las ventas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadSales();
  };

  const handleConfirmPayment = async (venta: Venta) => {
    setProcessingId(venta.id);
    try {
      // 1. Emitir comprobante a NubeFact / SUNAT
      const isSpecial = venta.numero_asiento === 0 || venta.culqi_charge_id?.includes('ESPECIAL');
      const sunatRes = await emitirComprobanteSunat({
        ventaId: venta.id,
        tipoDocumento: venta.tipo_documento,
        nroDocumento: venta.nro_documento,
        nombres: venta.nombres,
        apellidos: venta.apellidos,
        email: venta.email,
        razonSocial: venta.razon_social,
        direccionFiscal: venta.direccion_fiscal,
        descripcionOpcional: venta.descripcion_opcional,
        origen: venta.viajes?.rutas?.origen || 'CUSCO',
        destino: venta.viajes?.rutas?.destino || 'QUILLABAMBA',
        asiento: venta.numero_asiento,
        monto: Number(venta.monto_pagado),
        fechaViaje: venta.viajes?.fecha_viaje || '',
        horaViaje: venta.viajes?.hora_viaje || '',
        esViajeEspecial: isSpecial,
      });

      const finalUrl = sunatRes.pdfUrl || venta.comprobante_url;
      const finalNro = sunatRes.serie && sunatRes.numero ? `${sunatRes.serie}-${sunatRes.numero}` : venta.nro_comprobante;

      // 2. Actualizar Supabase
      await supabase
        .from('ventas')
        .update({
          comprobante_emitido: true,
          estado: 'CONFIRMADO',
          comprobante_url: finalUrl,
          nro_comprobante: finalNro,
        })
        .eq('id', venta.id);

      // 3. Enviar correo al pasajero vía Resend
      if (venta.email) {
        await sendConfirmationEmail(venta, {
          pdfUrl: sunatRes.pdfUrl,
          xmlUrl: sunatRes.xmlUrl,
          serie: sunatRes.serie,
          numero: sunatRes.numero,
        });
      }

      // 4. Actualizar estado local
      setVentas((prev) =>
        prev.map((v) =>
          v.id === venta.id
            ? {
                ...v,
                comprobante_emitido: true,
                estado: 'CONFIRMADO',
                comprobante_url: finalUrl,
                nro_comprobante: finalNro,
              }
            : v
        )
      );

      Alert.alert(
        '✅ Pago Confirmado',
        `¡Comprobante emitido con éxito!\nSerie: ${finalNro || 'SUNAT'}\nCorreo enviado a ${venta.email}`
      );
    } catch (err: any) {
      console.error('Error confirmando venta:', err);
      Alert.alert('Error', err.message || 'No se pudo confirmar el pago.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectPayment = (venta: Venta) => {
    Alert.alert(
      'Rechazar Pago',
      `¿Estás seguro de que deseas rechazar este pago de ${venta.nombres} ${venta.apellidos} (S/ ${Number(
        venta.monto_pagado
      ).toFixed(2)})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar y Liberar Asiento',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(venta.id);
            try {
              // Liberar asiento
              if (venta.viaje_id && venta.numero_asiento) {
                await supabase
                  .from('asientos_bloqueos')
                  .delete()
                  .eq('viaje_id', venta.viaje_id)
                  .eq('numero_asiento', venta.numero_asiento);
              }

              // Marcar como rechazada
              await supabase
                .from('ventas')
                .update({
                  estado: 'RECHAZADO',
                  culqi_charge_id: `RECHAZADO_${Date.now()}`,
                })
                .eq('id', venta.id);

              setVentas((prev) =>
                prev.map((v) =>
                  v.id === venta.id
                    ? {
                        ...v,
                        estado: 'RECHAZADO',
                        culqi_charge_id: `RECHAZADO_${Date.now()}`,
                      }
                    : v
                )
              );

              Alert.alert('Aviso', 'Pago rechazado y asiento liberado.');
            } catch (err: any) {
              console.error('Error rechazando pago:', err);
              Alert.alert('Error', err.message || 'No se pudo rechazar.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleViewPdf = async (venta: Venta) => {
    if (venta.comprobante_url && venta.comprobante_url.includes('nubefact.com')) {
      Linking.openURL(venta.comprobante_url);
    } else {
      // Emitir en el momento si aún no tenía
      handleConfirmPayment(venta);
    }
  };

  const handleResendEmail = async (venta: Venta) => {
    setProcessingId(venta.id);
    const result = await sendConfirmationEmail(venta, {
      pdfUrl: venta.comprobante_url || undefined,
    });
    setProcessingId(null);

    if (result.success) {
      Alert.alert('Éxito', result.message || 'Correo reenviado correctamente.');
    } else {
      Alert.alert('Aviso', result.error || 'No se pudo reenviar el correo.');
    }
  };

  const handleDeleteSpecialSale = (venta: Venta) => {
    Alert.alert(
      '🗑️ Eliminar Venta Especial',
      `¿Estás seguro de que deseas ELIMINAR esta venta especial por equivocación?\n\n• Pasajero / Razón Social: ${venta.nombres} ${venta.apellidos}\n• Documento: ${venta.tipo_documento} ${venta.nro_documento}\n• Monto: S/ ${Number(venta.monto_pagado).toFixed(2)}\n• Comprobante: ${venta.nro_comprobante || 'Generado'}\n\nEsta acción eliminará el registro de la base de datos de manera permanente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar Venta',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(venta.id);
            try {
              const { error } = await supabase
                .from('ventas')
                .delete()
                .eq('id', venta.id);

              if (error) throw error;

              setVentas((prev) => prev.filter((v) => v.id !== venta.id));
              Alert.alert('✅ Eliminado', 'La venta especial y su comprobante fueron eliminados.');
            } catch (err: any) {
              console.error('Error eliminando venta especial:', err);
              Alert.alert('Error', err.message || 'No se pudo eliminar la venta especial.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const filteredVentas = ventas.filter((v) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      v.nombres?.toLowerCase().includes(q) ||
      v.apellidos?.toLowerCase().includes(q) ||
      v.nro_documento?.includes(q) ||
      v.culqi_charge_id?.toLowerCase().includes(q) ||
      v.nro_comprobante?.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    // Date Filter (matching created_at or trip date)
    if (selectedDateFilter) {
      const matchCreatedAt = v.created_at?.startsWith(selectedDateFilter);
      const matchTripDate = v.viajes?.fecha_viaje === selectedDateFilter;
      if (!matchCreatedAt && !matchTripDate) return false;
    }

    const isConfirmed = v.comprobante_emitido || v.estado === 'CONFIRMADO';
    const isSpecial = v.numero_asiento <= 0 || Boolean(v.culqi_charge_id?.includes('ESPECIAL'));

    if (filterStatus === 'PENDING') return !isConfirmed && v.estado !== 'RECHAZADO';
    if (filterStatus === 'CONFIRMED') return isConfirmed;
    if (filterStatus === 'ESPECIAL') return isSpecial;
    return true;
  });

  return (
    <View style={styles.container}>
      <Header
        title="Gestión de Ventas"
        subtitle={`${filteredVentas.length} ventas encontradas`}
        onRefresh={onRefresh}
        isRefreshing={refreshing}
      />

      {/* Search & Filter Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBox}>
          <Search size={16} color={THEME.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar por DNI, Pasajero, Yape..."
          />
        </View>

        <TouchableOpacity style={styles.newSaleBtn} onPress={onOpenDirectSale}>
          <Plus size={16} color="#FFF" />
          <Text style={styles.newSaleBtnText}>Vender</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips Scrollable */}
      <View style={styles.chipsScrollWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <TouchableOpacity
            style={[styles.chip, filterStatus === 'ALL' && styles.chipActive]}
            onPress={() => setFilterStatus('ALL')}
          >
            <Text style={[styles.chipText, filterStatus === 'ALL' && styles.chipTextActive]}>
              Todas ({ventas.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, filterStatus === 'PENDING' && styles.chipActiveWarning]}
            onPress={() => setFilterStatus('PENDING')}
          >
            <Text style={[styles.chipText, filterStatus === 'PENDING' && styles.chipTextActiveWarning]}>
              ⏳ Por Verificar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, filterStatus === 'CONFIRMED' && styles.chipActiveSuccess]}
            onPress={() => setFilterStatus('CONFIRMED')}
          >
            <Text style={[styles.chipText, filterStatus === 'CONFIRMED' && styles.chipTextActiveSuccess]}>
              ✅ Confirmadas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.chip,
              filterStatus === 'ESPECIAL' && { backgroundColor: '#742284', borderColor: '#742284' }
            ]}
            onPress={() => setFilterStatus('ESPECIAL')}
          >
            <Text style={[
              styles.chipText,
              filterStatus === 'ESPECIAL' && { color: '#FFF', fontWeight: '800' }
            ]}>
              ✨ Especiales
            </Text>
          </TouchableOpacity>

          {/* Calendar Picker Filter Chip */}
          <TouchableOpacity
            style={[
              styles.chip,
              styles.calendarChip,
              selectedDateFilter ? styles.chipActive : null,
            ]}
            onPress={() => setShowDateCalendar(true)}
          >
            <Calendar size={13} color={selectedDateFilter ? '#FFF' : THEME.colors.primary} />
            <Text
              style={[
                styles.chipText,
                selectedDateFilter ? styles.chipTextActive : { color: THEME.colors.primary },
              ]}
            >
              {selectedDateFilter ? `📅 ${formatPeruDateDisplay(selectedDateFilter)}` : '📅 Fecha'}
            </Text>
            {selectedDateFilter && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation?.();
                  setSelectedDateFilter(null);
                }}
                style={styles.clearDateBtn}
              >
                <X size={12} color="#FFF" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Sales List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
          <Text style={styles.loadingText}>Cargando ventas del sistema...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredVentas}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SaleCard
              venta={item}
              onConfirm={handleConfirmPayment}
              onReject={handleRejectPayment}
              onViewPdf={handleViewPdf}
              onResendEmail={handleResendEmail}
              onDeleteSpecial={handleDeleteSpecialSale}
              isProcessing={processingId === item.id}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No hay ventas que coincidan con la búsqueda o fecha seleccionada.</Text>
            </View>
          }
        />
      )}

      {/* Calendar Filter Modal */}
      <CalendarModal
        visible={showDateCalendar}
        selectedDate={selectedDateFilter || getPeruTodayString()}
        minDate=""
        onSelectDate={(newDate) => {
          setSelectedDateFilter(newDate);
        }}
        onClose={() => setShowDateCalendar(false)}
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
    paddingTop: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  newSaleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    ...THEME.shadows.sm,
  },
  newSaleBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  chipsScrollWrapper: {
    backgroundColor: THEME.colors.background,
  },
  chipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  calendarChip: {
    borderColor: THEME.colors.primary,
  },
  clearDateBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    padding: 2,
    marginLeft: 2,
  },
  chipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  chipActiveWarning: {
    backgroundColor: THEME.colors.warning,
    borderColor: THEME.colors.warning,
  },
  chipActiveSuccess: {
    backgroundColor: THEME.colors.success,
    borderColor: THEME.colors.success,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFF',
  },
  chipTextActiveWarning: {
    color: '#FFF',
  },
  chipTextActiveSuccess: {
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
