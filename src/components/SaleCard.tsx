import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { THEME } from '../constants/theme';
import { Venta } from '../types/database';
import { CheckCircle2, XCircle, FileText, Share2, Phone, MessageCircle, Mail, Clock } from 'lucide-react-native';
import { generateAndShareTicket } from '../services/ticketPdfService';

interface SaleCardProps {
  venta: Venta;
  onConfirm: (venta: Venta) => void;
  onReject: (venta: Venta) => void;
  onViewPdf: (venta: Venta) => void;
  onResendEmail: (venta: Venta) => void;
  isProcessing?: boolean;
}

export const SaleCard: React.FC<SaleCardProps> = ({
  venta,
  onConfirm,
  onReject,
  onViewPdf,
  onResendEmail,
  isProcessing,
}) => {
  const isConfirmed = venta.comprobante_emitido || venta.estado === 'CONFIRMADO';
  const isRejected = venta.estado === 'RECHAZADO' || venta.culqi_charge_id?.startsWith('RECHAZADO_');
  const isPending = !isConfirmed && !isRejected;

  const handleCall = () => {
    if (venta.telefono) {
      Linking.openURL(`tel:${venta.telefono.replace(/\s+/g, '')}`);
    } else {
      Alert.alert('Aviso', 'No hay número de teléfono registrado.');
    }
  };

  const handleWhatsApp = () => {
    if (venta.telefono) {
      const cleanPhone = venta.telefono.replace(/\D/g, '');
      const fullPhone = cleanPhone.startsWith('51') ? cleanPhone : `51${cleanPhone}`;
      const msg = encodeURIComponent(
        `Hola ${venta.nombres}, le saludamos de Inversiones Tunky Chasky sobre su pasaje a ${venta.viajes?.rutas?.destino || 'su destino'} (Asiento #${venta.numero_asiento}).`
      );
      Linking.openURL(`https://wa.me/${fullPhone}?text=${msg}`);
    } else {
      Alert.alert('Aviso', 'No hay número de teléfono registrado.');
    }
  };

  return (
    <View style={[styles.card, isPending && styles.pendingCard, isRejected && styles.rejectedCard]}>
      {/* Header Row */}
      <View style={styles.cardHeader}>
        <View style={styles.badgeContainer}>
          {isConfirmed && (
            <View style={[styles.statusBadge, styles.badgeConfirmed]}>
              <CheckCircle2 size={12} color={THEME.colors.success} />
              <Text style={styles.badgeTextConfirmed}>CONFIRMADO</Text>
            </View>
          )}
          {isPending && (
            <View style={[styles.statusBadge, styles.badgePending]}>
              <Text style={styles.badgeTextPending}>⏳ POR VERIFICAR</Text>
            </View>
          )}
          {isRejected && (
            <View style={[styles.statusBadge, styles.badgeRejected]}>
              <XCircle size={12} color={THEME.colors.danger} />
              <Text style={styles.badgeTextRejected}>RECHAZADO</Text>
            </View>
          )}
        </View>

        <Text style={styles.priceText}>S/ {Number(venta.monto_pagado).toFixed(2)}</Text>
      </View>

      {/* Main Info */}
      <View style={styles.mainInfo}>
        <Text style={styles.passengerName}>
          {venta.nombres} {venta.apellidos}
        </Text>
        <Text style={styles.documentText}>
          {venta.tipo_documento}: <Text style={styles.boldText}>{venta.nro_documento}</Text>
          {venta.razon_social ? ` • ${venta.razon_social}` : ''}
        </Text>

        <View style={styles.routeBox}>
          <Text style={styles.routeText}>
            {venta.viajes?.rutas?.origen || 'CUSCO'} ➔ {venta.viajes?.rutas?.destino || 'QUILLABAMBA'}
          </Text>
          <View style={[
            styles.seatBadge,
            (venta.numero_asiento === 0 || venta.culqi_charge_id?.includes('ESPECIAL')) && {
              backgroundColor: '#FAF5FF',
              borderColor: '#E9D5FF',
            }
          ]}>
            <Text style={[
              styles.seatBadgeText,
              (venta.numero_asiento === 0 || venta.culqi_charge_id?.includes('ESPECIAL')) && {
                color: '#742284',
                fontWeight: '800',
              }
            ]}>
              {venta.numero_asiento === 0 || venta.culqi_charge_id?.includes('ESPECIAL')
                ? '✨ Especial'
                : `Asiento #${venta.numero_asiento}`}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            📅 Viaje: {venta.viajes?.fecha_viaje || ''} {venta.viajes?.hora_viaje ? venta.viajes.hora_viaje.substring(0, 5) : ''}
          </Text>
          <Text style={styles.metaText}>
            💳 {venta.metodo_pago || 'YAPE'} {venta.culqi_charge_id?.includes('YAPE') ? `(${venta.culqi_charge_id.replace('YAPE-', '')})` : ''}
          </Text>
        </View>

        {venta.created_at ? (
          <View style={styles.purchaseTimeBox}>
            <Clock size={12} color="#742284" />
            <Text style={styles.purchaseTimeText}>
              Comprado el:{' '}
              {new Date(venta.created_at).toLocaleString('es-PE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
              })}
            </Text>
          </View>
        ) : null}

        {venta.nro_comprobante && (
          <View style={styles.invoiceBadge}>
            <Text style={styles.invoiceBadgeText}>🧾 SUNAT: {venta.nro_comprobante}</Text>
          </View>
        )}
      </View>

      {/* Communication Actions */}
      <View style={styles.commActionsRow}>
        <TouchableOpacity style={styles.commButton} onPress={handleCall}>
          <Phone size={14} color={THEME.colors.textSecondary} />
          <Text style={styles.commButtonText}>Llamar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.commButton, styles.whatsappButton]} onPress={handleWhatsApp}>
          <MessageCircle size={14} color="#10B981" />
          <Text style={[styles.commButtonText, { color: '#059669' }]}>WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.commButton}
          onPress={() => generateAndShareTicket(venta)}
        >
          <Share2 size={14} color={THEME.colors.accentDark} />
          <Text style={[styles.commButtonText, { color: THEME.colors.accentDark }]}>Boleto</Text>
        </TouchableOpacity>
      </View>

      {/* Primary Actions */}
      <View style={styles.actionButtonsRow}>
        {isPending && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.confirmBtn]}
              onPress={() => onConfirm(venta)}
              disabled={isProcessing}
            >
              <CheckCircle2 size={16} color="#FFF" />
              <Text style={styles.actionBtnTextWhite}>
                {isProcessing ? 'Emitiendo...' : 'Confirmar y Emitir SUNAT'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => onReject(venta)}
              disabled={isProcessing}
            >
              <XCircle size={16} color={THEME.colors.danger} />
            </TouchableOpacity>
          </>
        )}

        {isConfirmed && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.pdfBtn]}
              onPress={() => onViewPdf(venta)}
            >
              <FileText size={15} color="#DC2626" />
              <Text style={[styles.actionBtnText, { color: '#DC2626' }]}>PDF SUNAT</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.emailBtn]}
              onPress={() => onResendEmail(venta)}
            >
              <Mail size={15} color={THEME.colors.primary} />
              <Text style={[styles.actionBtnText, { color: THEME.colors.primary }]}>Reenviar</Text>
            </TouchableOpacity>
          </>
        )}
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
  pendingCard: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF5',
  },
  rejectedCard: {
    borderColor: '#FECACA',
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeConfirmed: {
    backgroundColor: THEME.colors.successLight,
  },
  badgeTextConfirmed: {
    color: '#047857',
    fontSize: 10,
    fontWeight: '800',
  },
  badgePending: {
    backgroundColor: THEME.colors.warningLight,
  },
  badgeTextPending: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '800',
  },
  badgeRejected: {
    backgroundColor: THEME.colors.dangerLight,
  },
  badgeTextRejected: {
    color: '#B91C1C',
    fontSize: 10,
    fontWeight: '800',
  },
  priceText: {
    fontSize: 17,
    fontWeight: '900',
    color: THEME.colors.primary,
  },
  mainInfo: {
    marginBottom: 10,
  },
  passengerName: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  documentText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  boldText: {
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  routeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  routeText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  seatBadge: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  seatBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metaText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  purchaseTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  purchaseTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#742284',
  },
  invoiceBadge: {
    backgroundColor: '#EFF6FF',
    padding: 6,
    borderRadius: 6,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.accent,
  },
  invoiceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  commActionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
    marginBottom: 8,
  },
  commButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingVertical: 6,
    borderRadius: 6,
  },
  whatsappButton: {
    backgroundColor: '#ECFDF5',
  },
  commButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  confirmBtn: {
    flex: 4,
    backgroundColor: THEME.colors.primary,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: THEME.colors.dangerLight,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  pdfBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  emailBtn: {
    backgroundColor: THEME.colors.primarySoft,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  actionBtnTextWhite: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
