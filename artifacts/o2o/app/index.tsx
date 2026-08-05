import { router, navigationRef } from "@/compat/router";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, StatusBar } from "react-native";
import { useAuth } from "@/context/AuthContext";
import Video from "react-native-video";

export default function SplashScreen() {
  const { user, isLoading } = useAuth();
  const navigated = useRef(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    // Hide status bar for full screen splash experience
    StatusBar.setHidden(true);
    return () => {
      StatusBar.setHidden(false);
    };
  }, []);

  useEffect(() => {
    // Only navigate when both auth state is known AND video has finished (or errored)
    if (isLoading) return;
    if (!videoEnded && !videoError) return;
    if (navigated.current) return;

    const navigate = () => {
      if (navigated.current) return;
      navigated.current = true;
      if (user) {
        router.replace("/(tabs)");
      } else {
        router.replace("/welcome");
      }
    };

    if (!navigationRef.isReady()) {
      const interval = setInterval(() => {
        if (navigationRef.isReady()) {
          clearInterval(interval);
          navigate();
        }
      }, 50);
    } else {
      navigate();
    }
  }, [isLoading, user, videoEnded, videoError]);

  return (
    <View style={[styles.container, { backgroundColor: "#044D2A" }]}>
      <Video
        source={require("../assets/images/splash.mp4")}
        style={styles.video}
        resizeMode="cover"
        onEnd={() => setVideoEnded(true)}
        onError={(err) => {
          console.warn("Splash video error:", err);
          setVideoError(true);
        }}
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
    flex: 1,
    backgroundColor: "#044D2A" // Brand green matching native splash
  },
  video: {
    width: "100%",
    height: "100%"
  }
});
