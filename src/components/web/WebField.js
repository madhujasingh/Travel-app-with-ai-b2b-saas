// One field inside a WebSearchPanel: a white label above a white pill showing
// the current value with a trailing icon. Pressing it opens whatever picker the
// screen already uses, so this is presentation only - no picker logic lives here.
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

const WebField = ({
  label,
  value,
  placeholder,
  icon = 'chevron-down',
  onPress,
  disabled = false,
  loading = false,
  flex = 1,
  minWidth = 150,
  // Dark labels for the light (white card) panel variant.
  tone = 'onDark',
  // Typed fields (budget, traveller counts) rather than picker-backed ones.
  onChangeText,
  keyboardType,
  maxLength,
}) => {
  if (onChangeText) {
    return (
      <View style={[styles.wrap, { flex, minWidth }]}>
        <Text style={[styles.label, tone === 'onLight' && styles.labelOnLight]}>{label}</Text>
        <View style={styles.pill}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={Colors.textMuted}
            keyboardType={keyboardType}
            maxLength={maxLength}
          />
          <Ionicons name={icon} size={17} color={Colors.textMuted} />
        </View>
      </View>
    );
  }

  return (
  <View style={[styles.wrap, { flex, minWidth }]}>
    <Text style={[styles.label, tone === 'onLight' && styles.labelOnLight]}>{label}</Text>
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ hovered }) => [
        styles.pill,
        hovered && !disabled && styles.pillHovered,
        disabled && styles.pillDisabled,
      ]}
    >
      <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
        {value || placeholder}
      </Text>
      {loading ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : (
        <Ionicons name={icon} size={17} color={Colors.textMuted} />
      )}
    </Pressable>
  </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  labelOnLight: {
    color: Colors.textLight,
  },
  pill: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    transitionDuration: '150ms',
    transitionProperty: 'border-color',
  },
  pillHovered: {
    borderColor: Colors.primary,
  },
  pillDisabled: {
    opacity: 0.55,
  },
  value: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  placeholder: {
    fontWeight: '500',
    color: Colors.textMuted,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    // react-native-web renders TextInput as an <input>, which brings its own
    // focus ring; the pill already shows focus through its border.
    outlineStyle: 'none',
  },
});

export default WebField;
