// Single source of truth for layout breakpoints.
//
// The app was built phone-first, so `isDesktop` is the flag that switches a
// screen into its web layout: wider gutters, multi-column grids, and the top
// header nav instead of the floating bottom tab bar.
import { useWindowDimensions } from 'react-native';

export const Breakpoints = {
  tablet: 768,
  desktop: 1024,
  wide: 1440,
};

// Caps the reading width of a centered column. Full-bleed phone layouts look
// broken past roughly this width - lines get too long and cards stretch.
export const CONTENT_MAX_WIDTH = 1200;

// Forms - login, checkout, passenger details - want a much narrower column than
// a listing grid. A single input stretched to 1200px is unusable to scan.
export const FORM_MAX_WIDTH = 720;

export const useResponsive = () => {
  const { width, height } = useWindowDimensions();

  const isTablet = width >= Breakpoints.tablet && width < Breakpoints.desktop;
  const isDesktop = width >= Breakpoints.desktop;

  return {
    width,
    height,
    isPhone: width < Breakpoints.tablet,
    isTablet,
    isDesktop,
    isWide: width >= Breakpoints.wide,
    // Handy for grids: how many cards fit comfortably across.
    columns: width >= Breakpoints.wide ? 4 : isDesktop ? 3 : isTablet ? 2 : 1,
    // Screens use this for horizontal padding so gutters grow with the viewport.
    gutter: isDesktop ? 32 : isTablet ? 24 : 16,
    // Drop straight into a ScrollView/FlatList contentContainerStyle to cap and
    // centre the column on wide viewports. Null on phones, so spreading it into
    // a style array leaves the existing mobile layout untouched.
    centeredContent:
      isDesktop || isTablet
        ? { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }
        : null,
    // Same idea, narrower - for form and checkout screens.
    centeredForm:
      isDesktop || isTablet
        ? { width: '100%', maxWidth: FORM_MAX_WIDTH, alignSelf: 'center' }
        : null,
  };
};

export default useResponsive;
