import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const addMonths = (date, count) => new Date(date.getFullYear(), date.getMonth() + count, 1);

const isSameDay = (left, right) =>
  !!left &&
  !!right &&
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const buildCalendarDays = (monthDate) => {
  const monthStart = startOfMonth(monthDate);
  const firstWeekDay = monthStart.getDay();
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - firstWeekDay);

  return Array.from({ length: 42 }, (_, index) => {
    const nextDate = new Date(calendarStart);
    nextDate.setDate(calendarStart.getDate() + index);
    return nextDate;
  });
};

const MONTH_LABEL = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Generic calendar-picker modal (dates only, no time) used anywhere the app
// needs a date input - flight search dates, DOB, passport issue/expiry -
// rather than free-text "type YYYY-MM-DD" fields prone to typos.
const DatePickerModal = ({ visible, title, initialDate, minDate, maxDate, onSelect, onClose }) => {
  const today = startOfDay(new Date());
  const [month, setMonth] = useState(startOfMonth(initialDate || maxDate || today));

  useEffect(() => {
    if (visible) {
      setMonth(startOfMonth(initialDate || maxDate || today));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const minBound = minDate ? startOfDay(minDate) : null;
  const maxBound = maxDate ? startOfDay(maxDate) : null;
  const isDisabled = (date) => (minBound && date < minBound) || (maxBound && date > maxBound);
  const canGoToPreviousMonth = !minBound || addMonths(month, -1) >= startOfMonth(minBound);

  const calendarDays = buildCalendarDays(month);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => {}}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>Choose date</Text>
              <Text style={styles.title}>{title}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={18} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.monthRow}>
            <TouchableOpacity
              style={[styles.arrowButton, !canGoToPreviousMonth && styles.arrowDisabled]}
              onPress={() => setMonth((m) => addMonths(m, -1))}
              disabled={!canGoToPreviousMonth}
            >
              <Ionicons name="chevron-back" size={18} color={canGoToPreviousMonth ? Colors.text : Colors.textMuted} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTH_LABEL.format(month)}</Text>
            <TouchableOpacity style={styles.arrowButton} onPress={() => setMonth((m) => addMonths(m, 1))}>
              <Ionicons name="chevron-forward" size={18} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((label) => (
              <Text key={label} style={styles.weekday}>{label}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {calendarDays.map((date) => {
              const isCurrentMonth = date.getMonth() === month.getMonth();
              const disabled = isDisabled(date);
              const selected = initialDate ? isSameDay(date, initialDate) : false;
              return (
                <TouchableOpacity
                  key={date.toISOString()}
                  style={[styles.day, selected && styles.daySelected, (!isCurrentMonth || disabled) && styles.dayMuted]}
                  onPress={() => onSelect(toDateString(date), date)}
                  disabled={disabled}
                >
                  <Text
                    style={[
                      styles.dayText,
                      !isCurrentMonth && styles.dayTextFaded,
                      disabled && styles.dayTextDisabled,
                      selected && styles.dayTextSelected,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 34, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: Colors.card,
    borderRadius: 28,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  arrowButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowDisabled: {
    opacity: 0.4,
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  day: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    marginBottom: 6,
  },
  daySelected: {
    backgroundColor: Colors.primary,
  },
  dayMuted: {
    opacity: 0.8,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  dayTextFaded: {
    color: Colors.textMuted,
  },
  dayTextDisabled: {
    color: '#C8CED8',
  },
  dayTextSelected: {
    color: Colors.secondary,
  },
});

export default DatePickerModal;
