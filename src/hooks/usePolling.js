import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

export default function usePolling(callback, intervalMs) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useFocusEffect(
    useCallback(() => {
      let intervalId = null;

      const start = () => {
        if (intervalId) {
          return;
        }
        callbackRef.current();
        intervalId = setInterval(() => callbackRef.current(), intervalMs);
      };

      const stop = () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      };

      start();

      const subscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          start();
        } else {
          stop();
        }
      });

      return () => {
        stop();
        subscription.remove();
      };
    }, [intervalMs])
  );
}
