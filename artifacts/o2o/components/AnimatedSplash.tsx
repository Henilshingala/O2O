import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Video from 'react-native-video';

const splashVideo = require('@/assets/images/splash.mp4');

interface AnimatedSplashProps {
  onFinish: () => void;
}

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const [isError, setIsError] = useState(false);

  const handleEnd = () => {
    onFinish();
  };

  const handleError = () => {
    setIsError(true);
    onFinish();
  };

  if (isError) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]}>
      <Video
        source={splashVideo}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onEnd={handleEnd}
        onError={handleError}
        controls={false}
        repeat={false}
        paused={false}
        fullscreen={false}
        ignoreSilentSwitch="obey"
        playInBackground={false}
        playWhenInactive={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#044D2A', // Match native splash color to prevent flashes
    zIndex: 99999,
    elevation: 99999,
  },
});
