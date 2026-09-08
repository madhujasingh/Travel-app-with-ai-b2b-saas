// react-native-maps has no working web build - importing it at all (even if the
// map screen is never visited) crashes the whole web bundle, because one of its
// internal components calls a native-only codegen API that react-native-web
// doesn't implement. Metro picks this file over MapViewCompat.js when bundling
// for web, so 'react-native-maps' is never touched in the web build.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/Colors';

const MapView = ({ style, children }) => (
  <View style={[styles.placeholder, style]}>
    <Text style={styles.text}>Map view isn't available on web yet.</Text>
    <Text style={styles.subtext}>Use the list view to browse hotels.</Text>
    {children}
  </View>
);

const Marker = () => null;
const Callout = () => null;

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.card,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  subtext: {
    marginTop: 6,
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
  },
});

export default MapView;
export { Marker, Callout };
