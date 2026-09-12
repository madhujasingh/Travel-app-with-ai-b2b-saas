// Tracks whether a hero screen has been scrolled far enough for the compact
// site header to take over from the hero's product tiles.
//
// Returns an `onScroll` to spread onto the screen's main ScrollView/FlatList and
// the `scrolled` flag to hand to WebStickyHeader.
import { useCallback, useState } from 'react';
import { HERO_SCROLL_THRESHOLD } from '../components/web/WebStickyHeader';
import useResponsive from './useResponsive';

export const useHeroHeader = () => {
  const { isDesktop } = useResponsive();
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = useCallback(
    (event) => {
      const y = event?.nativeEvent?.contentOffset?.y ?? 0;
      setScrolled((current) => {
        const next = y > HERO_SCROLL_THRESHOLD;
        return next === current ? current : next;
      });
    },
    [],
  );

  return {
    scrolled: isDesktop && scrolled,
    // Spread onto the scroll container. 16ms throttle keeps the slide-in smooth
    // without firing a state update on every pixel.
    scrollProps: isDesktop
      ? { onScroll: handleScroll, scrollEventThrottle: 16 }
      : {},
  };
};

export default useHeroHeader;
