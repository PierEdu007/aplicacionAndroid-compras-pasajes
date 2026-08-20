import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { THEME } from '../constants/theme';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Check } from 'lucide-react-native';
import { getPeruTodayString, getPeruTomorrowString, getPeruDate } from '../utils/dateHelper';

interface CalendarModalProps {
  visible: boolean;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  onClose: () => void;
  minDate?: string; // YYYY-MM-DD
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const CalendarModal: React.FC<CalendarModalProps> = ({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
  minDate = getPeruTodayString(),
}) => {
  const initialYear = selectedDate ? parseInt(selectedDate.split('-')[0], 10) : getPeruDate().getFullYear();
  const initialMonth = selectedDate ? parseInt(selectedDate.split('-')[1], 10) - 1 : getPeruDate().getMonth();

  const [currentYear, setCurrentYear] = useState(initialYear);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  const days = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  const handleDayPress = (day: number) => {
    const mm = String(currentMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const formattedDate = `${currentYear}-${mm}-${dd}`;
    onSelectDate(formattedDate);
    onClose();
  };

  const todayStr = getPeruTodayString();
  const tomorrowStr = getPeruTomorrowString();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <CalendarIcon size={20} color={THEME.colors.primary} />
              <Text style={styles.title}>Seleccionar Fecha</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Quick Shortcuts */}
          <View style={styles.quickShortcuts}>
            <TouchableOpacity
              style={[styles.shortcutBtn, selectedDate === todayStr && styles.shortcutBtnActive]}
              onPress={() => {
                onSelectDate(todayStr);
                onClose();
              }}
            >
              <Text style={[styles.shortcutText, selectedDate === todayStr && styles.shortcutTextActive]}>
                Hoy
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shortcutBtn, selectedDate === tomorrowStr && styles.shortcutBtnActive]}
              onPress={() => {
                onSelectDate(tomorrowStr);
                onClose();
              }}
            >
              <Text style={[styles.shortcutText, selectedDate === tomorrowStr && styles.shortcutTextActive]}>
                Mañana
              </Text>
            </TouchableOpacity>
          </View>

          {/* Month Navigation */}
          <View style={styles.monthHeader}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
              <ChevronLeft size={22} color={THEME.colors.textPrimary} />
            </TouchableOpacity>

            <Text style={styles.monthTitle}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </Text>

            <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
              <ChevronRight size={22} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Days of Week Header */}
          <View style={styles.daysOfWeekRow}>
            {DAY_NAMES.map((d) => (
              <Text key={d} style={styles.dayOfWeekText}>
                {d}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.daysGrid}>
            {days.map((day, idx) => {
              if (day === null) {
                return <View key={`empty-${idx}`} style={styles.dayCell} />;
              }

              const mm = String(currentMonth + 1).padStart(2, '0');
              const dd = String(day).padStart(2, '0');
              const dateStr = `${currentYear}-${mm}-${dd}`;
              const isSelected = selectedDate === dateStr;
              const isPast = Boolean(minDate && dateStr < minDate);
              const isToday = dateStr === todayStr;

              return (
                <TouchableOpacity
                  key={`day-${day}`}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    isToday && !isSelected && styles.dayCellToday,
                  ]}
                  disabled={isPast}
                  onPress={() => handleDayPress(day)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                      isPast && styles.dayTextPast,
                      isToday && !isSelected && styles.dayTextToday,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  quickShortcuts: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  shortcutBtn: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  shortcutBtnActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  shortcutText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  shortcutTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  navBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceSubtle,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  daysOfWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
    paddingBottom: 6,
  },
  dayOfWeekText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    width: 38,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: 19,
  },
  dayCellSelected: {
    backgroundColor: THEME.colors.primary,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayTextToday: {
    color: THEME.colors.primary,
    fontWeight: '800',
  },
  dayTextPast: {
    color: '#CBD5E1',
  },
});
