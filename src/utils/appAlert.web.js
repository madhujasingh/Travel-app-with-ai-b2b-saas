// Web implementation of appAlert - see appAlert.js for the contract.
//
// react-native-web's Alert is a no-op, so this renders a real in-app dialog
// instead. Deliberately NOT a <Modal>: AlertHost is mounted at the app root and
// screens already open Modals of their own, and two visible Modals at once fail
// to open. A fixed-position overlay at the root sidesteps that entirely.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/Colors';

const DEFAULT_BUTTONS = [{ text: 'OK' }];

let notify = null;
let pending = [];

export const appAlert = (title, message, buttons, options) => {
  const request = {
    title,
    message,
    buttons: buttons && buttons.length ? buttons : DEFAULT_BUTTONS,
    options: options || {},
  };

  if (notify) {
    notify(request);
  } else {
    // Fired before the host mounted (e.g. during initial hydration) - hold it
    // so the message isn't lost, and flush once the host registers.
    pending.push(request);
  }
};

export const AlertHost = () => {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    notify = (request) => setQueue((current) => [...current, request]);
    if (pending.length) {
      const flushed = pending;
      pending = [];
      setQueue((current) => [...current, ...flushed]);
    }
    return () => {
      notify = null;
    };
  }, []);

  const current = queue[0];
  if (!current) {
    return null;
  }

  const dismiss = () => setQueue((rest) => rest.slice(1));

  const handlePress = (button) => {
    dismiss();
    // Match the native Alert contract: onPress fires after the dialog closes.
    if (typeof button?.onPress === 'function') {
      button.onPress();
    }
  };

  const handleBackdrop = () => {
    if (current.options.cancelable === false) {
      return;
    }
    const cancelButton = current.buttons.find((button) => button.style === 'cancel');
    dismiss();
    if (typeof current.options.onDismiss === 'function') {
      current.options.onDismiss();
    } else if (cancelButton && typeof cancelButton.onPress === 'function') {
      cancelButton.onPress();
    }
  };

  // Buttons sit in a row unless the labels are long enough to crowd each other.
  const isStacked =
    current.buttons.length > 2 ||
    current.buttons.some((button) => (button.text || '').length > 16);

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={handleBackdrop} />
      <View style={styles.dialog} accessibilityRole="alertdialog">
        {!!current.title && <Text style={styles.title}>{current.title}</Text>}
        {!!current.message && <Text style={styles.message}>{current.message}</Text>}
        <View style={[styles.buttonRow, isStacked && styles.buttonColumn]}>
          {current.buttons.map((button, index) => {
            const isCancel = button.style === 'cancel';
            const isDestructive = button.style === 'destructive';
            return (
              <Pressable
                key={`${button.text}-${index}`}
                style={({ hovered }) => [
                  styles.button,
                  isStacked && styles.buttonFull,
                  isCancel && styles.buttonCancel,
                  hovered && styles.buttonHovered,
                ]}
                onPress={() => handlePress(button)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    isCancel && styles.buttonTextCancel,
                    isDestructive && styles.buttonTextDestructive,
                  ]}
                >
                  {button.text || 'OK'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 9999,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(20, 16, 14, 0.45)',
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.card,
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 26,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 38,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textLight,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 22,
    gap: 10,
  },
  buttonColumn: {
    flexDirection: 'column-reverse',
    alignItems: 'stretch',
  },
  button: {
    minWidth: 92,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFull: {
    width: '100%',
  },
  buttonHovered: {
    opacity: 0.88,
  },
  buttonCancel: {
    backgroundColor: Colors.primarySoft,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.secondary,
  },
  buttonTextCancel: {
    color: Colors.primaryDark,
  },
  buttonTextDestructive: {
    color: Colors.secondary,
  },
});

export default appAlert;
