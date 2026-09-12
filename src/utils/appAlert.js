// Cross-platform replacement for React Native's Alert.alert.
//
// react-native-web ships Alert as a literal no-op (`static alert() {}`), so on
// web every confirmation, error and success message silently disappears. This
// module keeps the exact Alert.alert signature so call sites don't change:
//
//   appAlert('Title', 'Message', [{ text: 'OK', onPress }], { cancelable })
//
// On native it forwards straight to the real Alert. The web build
// (appAlert.web.js) renders an in-app modal instead.
import { Alert } from 'react-native';

export const appAlert = (title, message, buttons, options) =>
  Alert.alert(title, message, buttons, options);

// Native has nothing to render - the OS draws the dialog. The web build
// exports a real component, and App.js mounts it unconditionally.
export const AlertHost = () => null;

export default appAlert;
