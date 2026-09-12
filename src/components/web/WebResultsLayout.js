// Shared desktop results chrome: a compact coloured bar summarising the search,
// a filter sidebar on the left, and the result list on the right.
//
// Flights, Hotels and Cabs all land on the same shape, so the layout lives here
// rather than being rebuilt per screen. Each screen supplies its own bar content
// and its own filter groups; only the frame is shared.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { CONTENT_MAX_WIDTH } from '../../hooks/useResponsive';

export const WebResultsBar = ({ title, subtitle, actionLabel, onAction, onBack }) => (
  <View style={styles.bar}>
    <View style={styles.barInner}>
      {!!onBack && (
        <Pressable
          onPress={onBack}
          style={({ hovered }) => [styles.barBack, hovered && styles.barBackHovered]}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={19} color="#FFFFFF" />
        </Pressable>
      )}

      <View style={styles.barText}>
        <Text style={styles.barTitle} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={styles.barSubtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>

      {!!actionLabel && (
        <Pressable
          onPress={onAction}
          style={({ hovered }) => [styles.barAction, hovered && styles.barActionHovered]}
        >
          <Text style={styles.barActionText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  </View>
);

// One group of mutually exclusive options, rendered as check rows.
export const WebFilterGroup = ({ title, options, value, onChange }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    {options.map((option) => {
      const active = value === option.value;
      return (
        <Pressable
          key={String(option.value)}
          onPress={() => onChange(option.value)}
          style={({ hovered }) => [styles.row, hovered && styles.rowHovered]}
        >
          <View style={[styles.box, active && styles.boxActive]}>
            {active ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}
          </View>
          <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>{option.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

export const WebResultsCount = ({ count, noun = 'result' }) => (
  <View style={styles.card}>
    <Text style={styles.countText}>
      Total <Text style={styles.countNum}>{count}</Text> {noun}{count === 1 ? '' : 's'} found
    </Text>
  </View>
);

const WebResultsLayout = ({ sidebar, children }) => (
  <View style={styles.row2}>
    {/* The sidebar scrolls independently of the results: the row is viewport
        height, and a full filter set is taller than that. */}
    <ScrollView
      style={styles.sidebar}
      contentContainerStyle={styles.sidebarContent}
      showsVerticalScrollIndicator={false}
    >
      {sidebar}
    </ScrollView>
    <View style={styles.main}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  barInner: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  barBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barBackHovered: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  barText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  barTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  barSubtitle: {
    fontSize: 13.5,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  barAction: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  barActionHovered: {
    backgroundColor: Colors.primarySoft,
  },
  barActionText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: Colors.primary,
  },

  row2: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 22,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  sidebar: {
    width: 250,
    flexGrow: 0,
    flexShrink: 0,
  },
  sidebarContent: {
    gap: 14,
    paddingBottom: 28,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  rowHovered: {
    opacity: 0.75,
  },
  box: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textLight,
  },
  rowLabelActive: {
    color: Colors.text,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textLight,
  },
  countNum: {
    fontWeight: '800',
    color: Colors.text,
  },
});

export default WebResultsLayout;
