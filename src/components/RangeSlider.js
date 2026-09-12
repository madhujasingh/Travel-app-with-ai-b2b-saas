// Two-thumb range slider, built on PanResponder so it needs no native module -
// adding one would force a full pod-install / rebuild of the dev client, and
// this has to work on web anyway.
//
// All geometry and live values are read from refs inside the gesture handlers.
// An earlier version kept the drag origin on the same ref object that was
// reassigned every render, so the first onChange wiped it and every subsequent
// move computed `undefined + dx` - NaN, and the thumb froze.
import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/Colors';

const THUMB = 22;

const RangeSlider = ({
  min,
  max,
  low,
  high,
  onChange,
  formatLabel = (v) => String(Math.round(v)),
}) => {
  const [trackWidth, setTrackWidth] = useState(0);

  // Current values, refreshed each render so the handlers never read stale ones.
  const valuesRef = useRef({ low, high });
  valuesRef.current = { low, high };

  // Track geometry, likewise.
  const geometryRef = useRef({ min, max, usable: 0 });
  geometryRef.current = {
    min,
    max,
    span: Math.max(max - min, 1),
    usable: Math.max(trackWidth - THUMB, 1),
  };

  // Drag origin. Its own ref, so nothing above can clobber it mid-gesture.
  const startXRef = useRef(0);
  const trackWidthRef = useRef(0);
  trackWidthRef.current = trackWidth;

  // The responders are created once, so they'd otherwise capture the first
  // onChange closure forever.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const toX = (value) => {
    const { min: lo, span, usable } = geometryRef.current;
    const x = ((value - lo) / span) * usable;
    return Number.isFinite(x) ? Math.min(Math.max(x, 0), usable) : 0;
  };

  const toValue = (x) => {
    const { min: lo, span, usable } = geometryRef.current;
    const clamped = Math.min(Math.max(x, 0), usable);
    const value = lo + (clamped / usable) * span;
    return Number.isFinite(value) ? value : lo;
  };

  const makeResponder = (which) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Keep the gesture once it starts, so a parent ScrollView doesn't steal it.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        const { low: l, high: h } = valuesRef.current;
        startXRef.current = toX(which === 'low' ? l : h);
      },
      onPanResponderMove: (_event, gesture) => {
        if (!trackWidthRef.current) return;
        const next = toValue(startXRef.current + gesture.dx);
        const { low: l, high: h } = valuesRef.current;
        if (which === 'low') {
          onChangeRef.current(Math.min(next, h), h);
        } else {
          onChangeRef.current(l, Math.max(next, l));
        }
      },
    });

  // Built once; everything they need comes from refs.
  const lowResponder = useMemo(() => makeResponder('low'), []);
  const highResponder = useMemo(() => makeResponder('high'), []);

  const lowX = toX(low);
  const highX = toX(high);

  return (
    <View style={styles.wrap}>
      <View
        style={styles.track}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <View style={styles.rail} />
        <View style={[styles.fill, { left: lowX + THUMB / 2, width: Math.max(highX - lowX, 0) }]} />

        <View
          {...lowResponder.panHandlers}
          style={[styles.thumb, { left: lowX }]}
          accessibilityLabel="Minimum"
        />
        <View
          {...highResponder.panHandlers}
          style={[styles.thumb, { left: highX }]}
          accessibilityLabel="Maximum"
        />
      </View>

      <View style={styles.labels}>
        <Text style={styles.label}>{formatLabel(low)}</Text>
        <Text style={styles.label}>{formatLabel(high)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  track: {
    height: THUMB + 12,
    justifyContent: 'center',
  },
  rail: {
    height: 4,
    borderRadius: 2,
    marginHorizontal: THUMB / 2,
    backgroundColor: Colors.border,
  },
  fill: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.primary,
    cursor: 'pointer',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primary,
  },
});

export default RangeSlider;
