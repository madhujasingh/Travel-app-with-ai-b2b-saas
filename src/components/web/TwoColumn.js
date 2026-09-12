// Desktop two-column layout: primary content on the left, a companion rail on
// the right. Below the desktop breakpoint it renders `main` then `aside` in the
// original single-column order, so phone layouts are unchanged.
//
// This is the piece that makes a screen feel like a web page rather than a
// narrow phone column: capping the width alone leaves everything stacked
// top-to-bottom, which reads as squeezed AND endlessly long on a wide screen.
//
// The rail is sticky, so a price summary or booking box stays in view while the
// left column scrolls - `position: 'sticky'` is supported by react-native-web.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import useResponsive from '../../hooks/useResponsive';

const TwoColumn = ({
  main,
  aside,
  asideWidth = 360,
  stickyAside = true,
  // Put the rail on the left instead of the right - for nav sidebars, where a
  // right-hand placement would read as a companion panel rather than navigation.
  asideFirst = false,
  gap = 28,
  style,
}) => {
  const { isDesktop } = useResponsive();

  if (!isDesktop) {
    // Phone order always matches the original single-column markup: the aside
    // came after the main content there regardless of its desktop side.
    return (
      <View style={style}>
        {asideFirst ? aside : null}
        {main}
        {asideFirst ? null : aside}
      </View>
    );
  }

  const railColumn = !!aside && (
    <View style={[{ width: asideWidth }, stickyAside && styles.sticky]}>{aside}</View>
  );

  return (
    <View style={[styles.row, { gap }, style]}>
      {asideFirst ? railColumn : null}
      <View style={styles.main}>{main}</View>
      {asideFirst ? null : railColumn}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  main: {
    flex: 1,
    // Without this a long child (a wide table, a long unbroken string) forces
    // the flex item wider than its share and pushes the rail off screen.
    minWidth: 0,
  },
  sticky: {
    position: 'sticky',
    top: 20,
  },
});

export default TwoColumn;
