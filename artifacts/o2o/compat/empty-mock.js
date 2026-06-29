
export const BlurView = () => null;
export const KeyboardProvider = ({ children }) => children;
export const KeyboardAvoidingView = ({ children, style }) => {
  const React = require('react');
  const { View } = require('react-native');
  return React.createElement(View, { style }, children);
};
export const launchImageLibrary = async () => ({ didCancel: true });
export default function LinearGradient({ children, style }) {
  const React = require('react');
  const { View } = require('react-native');
  return React.createElement(View, { style }, children);
}
