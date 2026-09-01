import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(2000, i, 1))
);
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Rough row height for the year grid (4 columns) - only used to land the
// auto-scroll near the right spot on open, doesn't need to be exact.
const YEAR_ROW_HEIGHT = 56;

const toDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Generic calendar-picker modal (dates only, no time) used anywhere the app
// needs a date input - flight search dates, hotel check-in/out, DOB,
// passport issue/expiry - rather than free-text "type YYYY-MM-DD" fields
// prone to typos.
//
// Three navigation levels ('days' / 'months' / 'years'), not just one -
// picking a date decades away (an adult's date of birth, e.g.) used to mean
// tapping the prev-month arrow hundreds of times. Tapping the month/year
// header now drills into a year grid, then a month grid, then back to the
// day grid - three taps to reach any month, ever.
//
// rangeMode picks a start+end pair in one continuous session instead of two
// separate opens (e.g. hotel check-in immediately flowing into check-out):
// the first tap sets a pending start (highlighted, subtitle prompts for the
// end date); a later tap far enough past it confirms the pair via
// onSelectRange and closes. Tapping an earlier date restarts the start
// instead. minNights (default 1) sets how much later the end date must be -
// hotels need at least 1 night; pass 0 to allow the start/end date to match
// (e.g. a same-day flight return).
const DatePickerModal = ({
  visible,
  title,
  initialDate,
  minDate,
  maxDate,
  onSelect,
  onClose,
  rangeMode = false,
  onSelectRange,
  minNights = 1,
}) => {
  const today = startOfDay(new Date());
  const [month, setMonth] = useState(startOfMonth(initialDate || maxDate || today));
  const [pendingStart, setPendingStart] = useState(null);
  const [view, setView] = useState('days');
  const yearScrollRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setMonth(startOfMonth(initialDate || maxDate || today));
      setPendingStart(null);
      setView('days');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const minBound = minDate ? startOfDay(minDate) : null;
  const maxBound = maxDate ? startOfDay(maxDate) : null;
  // Deliberately NOT tightened by pendingStart while picking a range's end -
  // every originally-valid date stays tappable throughout, so tapping an
  // earlier date restarts the start (see handleDayPress) instead of that
  // date being disabled and stuck unreachable.
  const isDisabled = (date) => (minBound && date < minBound) || (maxBound && date > maxBound);
  const canGoToPreviousMonth = !minBound || addMonths(month, -1) >= startOfMonth(minBound);

  const calendarDays = buildCalendarDays(month);

  // Without an explicit bound, fall back to a century back / two decades
  // forward - generous enough for a date of birth or a passport expiry
  // without making the year list unusably long.
  const minYear = minBound ? minBound.getFullYear() : (maxBound || today).getFullYear() - 100;
  const maxYear = maxBound ? maxBound.getFullYear() : (minBound || today).getFullYear() + 20;
  const years = [];
  for (let y = maxYear; y >= minYear; y -= 1) years.push(y);

  const isMonthDisabled = (year, monthIndex) => {
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);
    return (maxBound && monthStart > maxBound) || (minBound && monthEnd < minBound);
  };
  const isYearDisabled = (year) => {
    for (let m = 0; m < 12; m += 1) {
      if (!isMonthDisabled(year, m)) return false;
    }
    return true;
  };

  const openYearPicker = () => {
    setView('years');
    const index = years.indexOf(month.getFullYear());
    if (index >= 0) {
      const row = Math.floor(index / 4);
      requestAnimationFrame(() => {
        yearScrollRef.current?.scrollTo({ y: Math.max(0, (row - 1) * YEAR_ROW_HEIGHT), animated: false });
      });
    }
  };

  const chooseYear = (year) => {
    setMonth((m) => new Date(year, m.getMonth(), 1));
    setView('months');
  };

  const chooseMonth = (monthIndex) => {
    setMonth((m) => new Date(m.getFullYear(), monthIndex, 1));
    setView('days');
  };

  const handleDayPress = (date) => {
    if (!rangeMode) {
      onSelect(toDateString(date), date);
      return;
    }
    const minEndDate = pendingStart
      ? new Date(pendingStart.getTime() + minNights * 24 * 60 * 60 * 1000)
      : null;
    if (!pendingStart || date < minEndDate) {
      // First tap, or not far enough past the pending start to be a valid
      // end - (re)start the range from here and wait for the end date.
      setPendingStart(date);
      return;
    }
    onSelectRange(toDateString(pendingStart), toDateString(date), pendingStart, date);
    setPendingStart(null);
  };

  const selectedDate = rangeMode ? pendingStart : initialDate;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => {}}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>
                {view === 'years'
                  ? 'Choose year'
                  : view === 'months'
                  ? 'Choose month'
                  : rangeMode && pendingStart
                  ? 'Now pick the end date'
                  : 'Choose date'}
              </Text>
              <Text style={styles.title}>{title}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={18} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {view === 'days' ? (
            <View style={styles.monthRow}>
              <TouchableOpacity
                style={[styles.arrowButton, !canGoToPreviousMonth && styles.arrowDisabled]}
                onPress={() => setMonth((m) => addMonths(m, -1))}
                disabled={!canGoToPreviousMonth}
              >
                <Ionicons name="chevron-back" size={18} color={canGoToPreviousMonth ? Colors.text : Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={openYearPicker}>
                <Text style={styles.monthLabel}>{MONTH_LABEL.format(month)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.arrowButton} onPress={() => setMonth((m) => addMonths(m, 1))}>
                <Ionicons name="chevron-forward" size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>
          ) : null}

          {view === 'months' ? (
            <View style={styles.monthRow}>
              <TouchableOpacity
                style={styles.arrowButton}
                onPress={() => setMonth((m) => new Date(m.getFullYear() - 1, m.getMonth(), 1))}
              >
                <Ionicons name="chevron-back" size={18} color={Colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={openYearPicker}>
                <Text style={styles.monthLabel}>{month.getFullYear()}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.arrowButton}
                onPress={() => setMonth((m) => new Date(m.getFullYear() + 1, m.getMonth(), 1))}
              >
                <Ionicons name="chevron-forward" size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>
          ) : null}

          <ScrollView ref={view === 'years' ? yearScrollRef : null} showsVerticalScrollIndicator={false}>
            {view === 'days' ? (
              <>
                <View style={styles.weekRow}>
                  {WEEKDAY_LABELS.map((label) => (
                    <Text key={label} style={styles.weekday}>{label}</Text>
                  ))}
                </View>
                <View style={styles.grid}>
                  {calendarDays.map((date) => {
                    const isCurrentMonth = date.getMonth() === month.getMonth();
                    const disabled = isDisabled(date);
                    const selected = selectedDate ? isSameDay(date, selectedDate) : false;
                    return (
                      <TouchableOpacity
                        key={date.toISOString()}
                        style={[styles.day, selected && styles.daySelected, (!isCurrentMonth || disabled) && styles.dayMuted]}
                        onPress={() => handleDayPress(date)}
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
              </>
            ) : null}

            {view === 'months' ? (
              <View style={styles.gridFour}>
                {MONTH_NAMES.map((label, index) => {
                  const disabled = isMonthDisabled(month.getFullYear(), index);
                  const selected = index === month.getMonth();
                  return (
                    <TouchableOpacity
                      key={label}
                      style={[styles.gridFourCell, selected && styles.daySelected, disabled && styles.dayMuted]}
                      onPress={() => chooseMonth(index)}
                      disabled={disabled}
                    >
                      <Text
                        style={[styles.gridFourCellText, selected && styles.dayTextSelected, disabled && styles.dayTextDisabled]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            {view === 'years' ? (
              <View style={styles.gridFour}>
                {years.map((year) => {
                  const disabled = isYearDisabled(year);
                  const selected = year === month.getFullYear();
                  return (
                    <TouchableOpacity
                      key={year}
                      style={[styles.gridFourCell, selected && styles.daySelected, disabled && styles.dayMuted]}
                      onPress={() => chooseYear(year)}
                      disabled={disabled}
                    >
                      <Text
                        style={[styles.gridFourCellText, selected && styles.dayTextSelected, disabled && styles.dayTextDisabled]}
                      >
                        {year}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>
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
    maxHeight: '90%',
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
  // Shared 4-column grid for both the month picker (12 cells) and the year
  // picker (variable, scrollable) - space-between spreads the 8% left over
  // from 4 x 23%-wide cells into the 3 gaps between them.
  gridFour: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridFourCell: {
    width: '23%',
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridFourCellText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
});

export default DatePickerModal;
