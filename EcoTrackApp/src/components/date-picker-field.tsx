import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface DatePickerFieldProps {
  label?: string;
  value: string; // Stored in YYYY-MM-DD format
  onChange: (isoDate: string) => void;
  placeholder?: string;
  error?: string;
  minYear?: number;
  maxYear?: number;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function formatToDisplayDate(isoString: string): string {
  if (!isoString) return '';
  const parts = isoString.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD -> MM/DD/YYYY
      const [year, month, day] = parts;
      return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
    } else if (parts[2].length === 4) {
      // MM/DD/YYYY
      const [month, day, year] = parts;
      return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
    }
  }
  return isoString;
}

export function parseToIsoDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const [year, month, day] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      // MM/DD/YYYY
      const [month, day, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return dateStr;
}

export default function DatePickerField({
  label,
  value,
  onChange,
  placeholder = 'MM/DD/YYYY',
  error,
  minYear = 1920,
  maxYear = new Date().getFullYear(),
}: DatePickerFieldProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [textValue, setTextValue] = useState(formatToDisplayDate(value));
  const [inlineError, setInlineError] = useState('');

  // Sync text value if external value prop changes
  useEffect(() => {
    const formatted = formatToDisplayDate(value);
    setTextValue(formatted);
    if (formatted) {
      setInlineError('');
    }
  }, [value]);

  // Parse initial state or default to current date
  const initialDate = value ? new Date(parseToIsoDate(value)) : new Date(2000, 0, 1);
  const validInitial = isNaN(initialDate.getTime()) ? new Date(2000, 0, 1) : initialDate;

  const [currentYear, setCurrentYear] = useState(validInitial.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(validInitial.getMonth());
  const [selectedIso, setSelectedIso] = useState(value ? parseToIsoDate(value) : '');
  const [showYearPicker, setShowYearPicker] = useState(false);

  const handleTextChange = (text: string) => {
    let clean = text;
    // If backspacing on a slash (e.g., user is at "05/" and presses backspace)
    if (textValue.endsWith('/') && text.length === textValue.length - 1) {
      clean = text.slice(0, -1);
    }

    const digits = clean.replace(/\D/g, '').slice(0, 8);
    let formatted = '';
    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    }

    setTextValue(formatted);

    if (digits.length === 8) {
      const m = parseInt(digits.slice(0, 2), 10);
      const d = parseInt(digits.slice(2, 4), 10);
      const y = parseInt(digits.slice(4, 8), 10);
      const maxDays = new Date(y, m, 0).getDate();

      if (m >= 1 && m <= 12 && d >= 1 && d <= maxDays && y >= minYear && y <= maxYear) {
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        setSelectedIso(iso);
        onChange(iso);
        setInlineError('');
      } else {
        setInlineError('Please enter a valid birthdate (MM/DD/YYYY).');
        onChange('');
      }
    } else {
      setInlineError('');
      if (digits.length === 0) {
        setSelectedIso('');
        onChange('');
      }
    }
  };

  const openPicker = () => {
    const cur = selectedIso ? new Date(selectedIso) : value ? new Date(parseToIsoDate(value)) : new Date(2000, 0, 1);
    const valid = isNaN(cur.getTime()) ? new Date(2000, 0, 1) : cur;
    setCurrentYear(valid.getFullYear());
    setCurrentMonth(valid.getMonth());
    setSelectedIso(value ? parseToIsoDate(value) : '');
    setShowYearPicker(false);
    setModalVisible(true);
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const yStr = String(currentYear);
    const mStr = String(currentMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const iso = `${yStr}-${mStr}-${dStr}`;
    const display = `${mStr}/${dStr}/${yStr}`;

    setSelectedIso(iso);
    setTextValue(display);
    setInlineError('');
    onChange(iso);
    setModalVisible(false);
  };

  const handleSelectYear = (year: number) => {
    setCurrentYear(year);
    setShowYearPicker(false);
  };

  // Calculate days in month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  // Generate years list
  const yearsList = [];
  for (let y = maxYear; y >= minYear; y--) {
    yearsList.push(y);
  }

  const activeError = error || inlineError;

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.inputBox, activeError ? styles.inputBoxError : null]}>
        <TextInput
          style={styles.inputText}
          value={textValue}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          keyboardType="numeric"
          maxLength={10}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={styles.iconContainer}
          onPress={openPicker}
          accessibilityLabel="Open calendar date picker"
          accessibilityRole="button"
        >
          <MaterialIcons name="calendar-today" size={20} color="#1F7A37" />
        </Pressable>
      </View>

      {activeError ? <Text style={styles.errorText}>{activeError}</Text> : null}

      {/* Calendar Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Birthdate</Text>
              <Pressable style={styles.closeIcon} onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={22} color="#666" />
              </Pressable>
            </View>

            {/* Month / Year Navigator */}
            <View style={styles.navRow}>
              <Pressable style={styles.navArrow} onPress={handlePrevMonth}>
                <MaterialIcons name="chevron-left" size={26} color="#1F7A37" />
              </Pressable>

              <View style={styles.monthYearSelector}>
                <Text style={styles.monthText}>{MONTH_NAMES[currentMonth]}</Text>
                <Pressable
                  style={styles.yearBadge}
                  onPress={() => setShowYearPicker((v) => !v)}
                >
                  <Text style={styles.yearText}>{currentYear}</Text>
                  <MaterialIcons
                    name={showYearPicker ? 'arrow-drop-up' : 'arrow-drop-down'}
                    size={20}
                    color="#1F7A37"
                  />
                </Pressable>
              </View>

              <Pressable style={styles.navArrow} onPress={handleNextMonth}>
                <MaterialIcons name="chevron-right" size={26} color="#1F7A37" />
              </Pressable>
            </View>

            {showYearPicker ? (
              /* Year Picker Grid */
              <View style={styles.yearPickerContainer}>
                <Text style={styles.yearPickerTitle}>Select Year</Text>
                <ScrollView style={styles.yearScroll} contentContainerStyle={styles.yearGrid}>
                  {yearsList.map((y) => (
                    <Pressable
                      key={y}
                      style={[
                        styles.yearItem,
                        y === currentYear && styles.yearItemActive,
                      ]}
                      onPress={() => handleSelectYear(y)}
                    >
                      <Text
                        style={[
                          styles.yearItemText,
                          y === currentYear && styles.yearItemTextActive,
                        ]}
                      >
                        {y}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : (
              /* Calendar Grid */
              <View style={styles.calendarContainer}>
                {/* Weekday headers */}
                <View style={styles.weekRow}>
                  {DAYS_OF_WEEK.map((d) => (
                    <Text key={d} style={styles.weekDayText}>
                      {d}
                    </Text>
                  ))}
                </View>

                {/* Days Grid */}
                <View style={styles.daysGrid}>
                  {/* Empty cells before month start */}
                  {Array.from({ length: firstDayIndex }).map((_, i) => (
                    <View key={`empty-${i}`} style={styles.dayCell} />
                  ))}

                  {/* Month days */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dayIso = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isSelected = selectedIso === dayIso;

                    return (
                      <Pressable
                        key={`day-${day}`}
                        style={[
                          styles.dayCell,
                          styles.dayButton,
                          isSelected && styles.dayButtonSelected,
                        ]}
                        onPress={() => handleSelectDay(day)}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            isSelected && styles.dayTextSelected,
                          ]}
                        >
                          {day}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Quick Actions */}
            <View style={styles.modalFooter}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A4A4A',
  },
  inputBox: {
    height: 48,
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9D9D9',
    backgroundColor: '#F7F7F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputBoxError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
    height: '100%',
    paddingVertical: 0,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#E8F7E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F7A37',
  },
  closeIcon: {
    padding: 4,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  navArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F8F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  yearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F7E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  yearText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F7A37',
  },
  calendarContainer: {
    marginBottom: 12,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 6,
  },
  weekDayText: {
    width: 36,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayButton: {
    borderRadius: 19,
  },
  dayButtonSelected: {
    backgroundColor: '#1F7A37',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  yearPickerContainer: {
    height: 240,
    marginBottom: 12,
  },
  yearPickerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  yearScroll: {
    flex: 1,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 4,
  },
  yearItem: {
    width: '30%',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  yearItemActive: {
    backgroundColor: '#1F7A37',
    borderColor: '#1F7A37',
  },
  yearItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  yearItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
});
