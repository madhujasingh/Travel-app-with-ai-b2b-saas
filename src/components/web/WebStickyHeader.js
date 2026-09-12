// The compact site header for screens that have a WebHero.
//
// On those screens the hero's own product tiles ARE the navigation, so showing
// the header at the same time puts two copies of the same nav on screen. This
// renders nothing until you scroll past the hero, then slides in as a fixed bar
// - the pattern the reference site uses.
//
// It is fixed-position rather than in-flow, so appearing and disappearing never
// reflows the page underneath it.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import WebHeaderNav from './WebHeaderNav';

export const HEADER_HEIGHT = 64;

// How far down the page the hero's tiles have scrolled out of reach. Below this
// the tiles are still visible and the bar would be redundant.
export const HERO_SCROLL_THRESHOLD = 320;

const WebStickyHeader = ({ visible, state }) => (
  <View
    style={[styles.bar, visible ? styles.visible : styles.hidden]}
    // Untouchable while hidden, or it would swallow clicks on the hero tiles.
    pointerEvents={visible ? 'auto' : 'none'}
  >
    <WebHeaderNav state={state} />
  </View>
);

const styles = StyleSheet.create({
  bar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    transitionDuration: '220ms',
    transitionProperty: 'opacity, transform',
  },
  visible: {
    opacity: 1,
    transform: [{ translateY: 0 }],
  },
  hidden: {
    opacity: 0,
    transform: [{ translateY: -HEADER_HEIGHT }],
  },
});

export default WebStickyHeader;
