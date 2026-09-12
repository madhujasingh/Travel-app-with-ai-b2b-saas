// Caps and centres a screen's content on wide viewports.
//
// Every screen in this app was written full-bleed, which is right on a phone and
// wrong at 1440px - cards stretch to absurd widths and text lines get too long
// to read. Wrapping a screen's scroll content in this keeps the phone layout
// byte-identical (it's a plain flex: 1 View below the desktop breakpoint) while
// giving the web build a proper centred column.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import useResponsive, { CONTENT_MAX_WIDTH } from '../../hooks/useResponsive';

const PageSection = ({ children, style, maxWidth = CONTENT_MAX_WIDTH, gutter = true }) => {
  const { isDesktop, isTablet, gutter: responsiveGutter } = useResponsive();

  if (!isDesktop && !isTablet) {
    return <View style={[styles.base, style]}>{children}</View>;
  }

  return (
    <View
      style={[
        styles.base,
        styles.centered,
        { maxWidth },
        gutter && { paddingHorizontal: responsiveGutter },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    width: '100%',
  },
  centered: {
    alignSelf: 'center',
  },
});

export default PageSection;
