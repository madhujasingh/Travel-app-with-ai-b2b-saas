// The dark translucent search panel that overlaps the bottom of the hero on
// desktop. Fields sit in one row with their labels above them, and the search
// action is a square orange button on the right.
//
// `tabs` renders an optional row above the fields (One Way / Round Trip style),
// `chips` an optional row below (special fares, trip options).
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { CONTENT_MAX_WIDTH } from '../../hooks/useResponsive';

export const WebPanelTabs = ({ options, value, onChange }) => (
  <View style={styles.tabRow}>
    {options.map((option) => {
      const isActive = option.value === value;
      return (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          style={({ hovered }) => [styles.tab, hovered && styles.tabHovered]}
        >
          <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{option.label}</Text>
          {isActive && <View style={styles.tabUnderline} />}
        </Pressable>
      );
    })}
  </View>
);

export const WebPanelChips = ({ label, options, value, onChange }) => (
  <View style={styles.chipRow}>
    {!!label && <Text style={styles.chipRowLabel}>{label}</Text>}
    {options.map((option) => {
      const isActive = option.value === value;
      return (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          style={({ hovered }) => [
            styles.chip,
            isActive && styles.chipActive,
            hovered && !isActive && styles.chipHovered,
          ]}
        >
          <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{option.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

const WebSearchPanel = ({
  tabs,
  chips,
  children,
  // An optional second row of fields, for forms with more inputs than fit on
  // one line - keeps them in the panel instead of pushing them below the fold.
  secondary,
  onSearch,
  searching = false,
  // 'light' is the white card used on Hotels: the fields sit on white rather
  // than over the photo, so labels go dark and the search button gets a label.
  variant = 'dark',
  // Multi-city has a variable number of legs, so its fields stack in rows and
  // the search button moves to its own line instead of sitting in the row.
  stacked = false,
  searchLabel,
}) => {
  const isLight = variant === 'light';

  const searchButton = (
    <Pressable
      onPress={onSearch}
      disabled={searching}
      style={({ hovered }) => [
        styles.searchButton,
        stacked && styles.searchButtonWide,
        isLight && searchLabel && styles.searchButtonLabelled,
        hovered && styles.searchButtonHovered,
        searching && styles.searchButtonDisabled,
      ]}
      accessibilityLabel="Search"
    >
      {searching ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : searchLabel && (stacked || isLight) ? (
        <>
          <Ionicons name="search" size={18} color="#FFFFFF" />
          <Text style={styles.searchButtonText}>{searchLabel}</Text>
        </>
      ) : (
        <Ionicons name="search" size={26} color="#FFFFFF" />
      )}
    </Pressable>
  );

  return (
    <View style={[styles.panel, isLight && styles.panelLight]}>
      {tabs}
      {stacked ? (
        <>
          <View style={styles.stack}>{children}</View>
          <View style={styles.stackAction}>{searchButton}</View>
        </>
      ) : (
        <>
          <View style={styles.fieldRow}>
            {children}
            {searchButton}
          </View>
          {!!secondary && <View style={styles.secondaryRow}>{secondary}</View>}
        </>
      )}
      {chips}
    </View>
  );
};

const styles = StyleSheet.create({
  panelLight: {
    backgroundColor: Colors.card,
    paddingHorizontal: 26,
    paddingVertical: 24,
    borderRadius: 18,
  },
  panel: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    backgroundColor: 'rgba(20, 16, 14, 0.78)',
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 20,
    gap: 14,
    // Lifts the panel over the hero image the way the reference does.
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    // A field's autocomplete dropdown is absolutely positioned and must paint
    // over the chips row below it, which comes later in document order.
    zIndex: 20,
  },
  searchButton: {
    width: 68,
    height: 56,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    transitionDuration: '150ms',
    transitionProperty: 'background-color',
  },
  searchButtonHovered: {
    backgroundColor: Colors.primaryDark,
  },
  searchButtonDisabled: {
    opacity: 0.7,
  },
  searchButtonWide: {
    width: 'auto',
    paddingHorizontal: 36,
  },
  searchButtonLabelled: {
    width: 'auto',
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 30,
  },
  searchButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stack: {
    gap: 12,
    zIndex: 20,
  },
  stackAction: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  tabRow: {
    flexDirection: 'row',
    gap: 26,
  },
  tab: {
    paddingBottom: 6,
  },
  tabHovered: {
    opacity: 0.85,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  tabUnderline: {
    height: 2.5,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginTop: 5,
  },

  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 12,
    zIndex: 10,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    zIndex: 1,
  },
  chipRowLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 4,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    transitionDuration: '150ms',
    transitionProperty: 'border-color, background-color',
  },
  chipHovered: {
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  chipActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(246, 106, 42, 0.14)',
  },
  chipText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  chipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
});

export default WebSearchPanel;
