// Chooses the navigation chrome for the current viewport: the existing floating
// bottom tab bar on phones and tablets, the site-style top header on desktop.
// Both are driven by the same tab navigator state, so nothing else in the app
// has to know which one is on screen.
import React from 'react';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import useResponsive from '../hooks/useResponsive';

const AppTabBar = (props) => {
  const { isDesktop } = useResponsive();

  // Every tab screen now renders its own WebHero, and each supplies a
  // WebStickyHeader that slides in once the hero scrolls away - so on desktop
  // the navigator itself contributes no chrome at all.
  if (isDesktop) {
    return null;
  }

  return <BottomTabBar {...props} />;
};

export default AppTabBar;
