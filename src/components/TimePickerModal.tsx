import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { THEME } from '../constants/theme';
import { Clock, X, Check } from 'lucide-react-native';

interface TimePickerModalProps {
  visible: boolean;
  selectedTime: string; // HH:MM
  onSelectTime: (time: string) => void;
  onClose: () => void;
}

const POPULAR_HOURS = [
  '05:00', '06:00', '07:00', '08:00', '09:00', '10:00',
  '11:00', '12:00', '13:00', '14:00', '15:00', '16:00',
  '17:00', '18:00', '19:00', '20:00', '21:00'
];

const HOURS = ['04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'];
const MINUTES = ['00', '15', '30', '45'];

export const TimePickerModal: React.FC<TimePickerModalProps> = ({
  visible,
  selectedTime,
  onSelectTime,
  onClose,
}) => {
  const [selectedH, setSelectedH] = useState(selectedTime ? selectedTime.split(':')[0] : '07');
  const [selectedM, setSelectedM] = useState(selectedTime ? (selectedTime.split(':')[1] || '00').substring(0, 2) : '00');
  const [tab, setTab] = useState<'QUICK' | 'CUSTOM'>('QUICK');

  const handleQuickSelect = (timeStr: string) => {
    onSelectTime(timeStr);
    onClose();
  };

  const handleConfirmCustom = () => {
    const formatted = `${selectedH}:${selectedM}`;
    onSelectTime(formatted);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Clock size={20} color={THEME.colors.primary} />
              <Text style={styles.title}>Seleccionar Hora de Salida</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'QUICK' && styles.tabBtnActive]}
              onPress={() => setTab('QUICK')}
            >
              <Text style={[styles.tabText, tab === 'QUICK' && styles.tabTextActive]}>
                Horarios Frecuentes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'CUSTOM' && styles.tabBtnActive]}
              onPress={() => setTab('CUSTOM')}
            >
              <Text style={[styles.tabText, tab === 'CUSTOM' && styles.tabTextActive]}>
                Hora Personalizada
              </Text>
            </TouchableOpacity>
          </View>

          {tab === 'QUICK' ? (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
              <View style={styles.quickGrid}>
                {POPULAR_HOURS.map((h) => {
                  const isSelected = selectedTime.substring(0, 5) === h;
                  const hourNum = parseInt(h.split(':')[0], 10);
                  const isPM = hourNum >= 12;
                  const display12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
                  const label12 = `${display12}:00 ${isPM ? 'PM' : 'AM'}`;

                  return (
                    <TouchableOpacity
                      key={h}
                      style={[styles.quickTimeCard, isSelected && styles.quickTimeCardActive]}
                      onPress={() => handleQuickSelect(h)}
                    >
                      <Text style={[styles.quickTimeText, isSelected && styles.quickTimeTextActive]}>
                        {h}
                      </Text>
                      <Text style={[styles.quickTimeSubText, isSelected && styles.quickTimeSubTextActive]}>
                        {label12}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            <View>
              {/* Hour & Minute Picker Columns */}
              <View style={styles.customPickerRow}>
                {/* Hours Column */}
                <View style={styles.pickerCol}>
                  <Text style={styles.colHeader}>Hora (HH)</Text>
                  <ScrollView style={styles.scrollCol} showsVerticalScrollIndicator={false}>
                    {HOURS.map((h) => {
                      const isSel = selectedH === h;
                      const hNum = parseInt(h, 10);
                      const isPM = hNum >= 12;
                      const display12 = hNum === 0 ? 12 : hNum > 12 ? hNum - 12 : hNum;

                      return (
                        <TouchableOpacity
                          key={h}
                          style={[styles.pickerItem, isSel && styles.pickerItemActive]}
                          onPress={() => setSelectedH(h)}
                        >
                          <Text style={[styles.pickerItemText, isSel && styles.pickerItemTextActive]}>
                            {h} ({display12} {isPM ? 'PM' : 'AM'})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Minutes Column */}
                <View style={styles.pickerCol}>
                  <Text style={styles.colHeader}>Minutos (MM)</Text>
                  <ScrollView style={styles.scrollCol} showsVerticalScrollIndicator={false}>
                    {MINUTES.map((m) => {
                      const isSel = selectedM === m;
                      return (
                        <TouchableOpacity
                          key={m}
                          style={[styles.pickerItem, isSel && styles.pickerItemActive]}
                          onPress={() => setSelectedM(m)}
                        >
                          <Text style={[styles.pickerItemText, isSel && styles.pickerItemTextActive]}>
                            :{m}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>

              {/* Confirm Custom Button */}
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmCustom}>
                <Check size={18} color="#FFF" />
                <Text style={styles.confirmBtnText}>
                  Establecer {selectedH}:{selectedM}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    ...THEME.shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  tabBtnActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  quickTimeCard: {
    width: '31%',
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 4,
  },
  quickTimeCardActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  quickTimeText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  quickTimeTextActive: {
    color: '#FFF',
  },
  quickTimeSubText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  quickTimeSubTextActive: {
    color: '#E0E7FF',
  },
  customPickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  pickerCol: {
    flex: 1,
  },
  colHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
    textAlign: 'center',
  },
  scrollCol: {
    height: 180,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  pickerItemActive: {
    backgroundColor: THEME.colors.primary,
  },
  pickerItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  pickerItemTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    ...THEME.shadows.md,
  },
  confirmBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
