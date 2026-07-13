package com.o2o.app;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.PackageList;
import com.facebook.soloader.SoLoader;
import java.util.List;

public class MainApplication extends Application implements ReactApplication {

  private final ReactNativeHost mReactNativeHost =
      new ReactNativeHost(this) {
        @Override
        public boolean getUseDeveloperSupport() {
          return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
          @SuppressWarnings("UnnecessaryLocalVariable")
          List<ReactPackage> packages = new PackageList(this).getPackages();
          packages.add(new SimpleFetchPackage());
          return packages;
        }

        @Override
        protected String getJSMainModuleName() {
          return "index";
        }
      };

  @Override
  public ReactNativeHost getReactNativeHost() {
    return mReactNativeHost;
  }

  @Override
  public void onCreate() {
    super.onCreate();
    SoLoader.init(this, /* native exopackage */ false);
    createNotificationChannels();
  }

  /**
   * Create typed Android notification channels for Firebase Cloud Messaging.
   *
   * Channel IDs MUST match the values sent in the FCM payload from the backend
   * (see api-server/src/lib/fcm.ts → channelId field).
   *
   * ALL channels use IMPORTANCE_HIGH so that:
   *   - Heads-up (peek) banners appear while the device is in use
   *   - Notifications appear on the lock screen (visibility=PUBLIC in payload)
   *   - Sound and vibration play immediately
   *
   * Channels are permanent once created — the system ignores updates to
   * importance/sound/vibration after the first install. Users can customise
   * each channel individually in Settings → App info → Notifications.
   * A fresh install (or clearing app data) picks up any channel changes.
   *
   * Required: Android 8.0+ (API 26+). Safe no-op on older versions.
   */
  private void createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

    NotificationManager nm = getSystemService(NotificationManager.class);
    if (nm == null) return;

    // Audio attributes shared by message-style channels
    AudioAttributes messageAudio = new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build();

    // Audio attributes shared by alert-style channels
    AudioAttributes alertAudio = new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build();

    // ── o2o_chat — Messages (IMPORTANCE_HIGH = heads-up banner) ───────────────
    NotificationChannel chatCh = new NotificationChannel(
        "o2o_chat",
        "Messages",
        NotificationManager.IMPORTANCE_HIGH     // heads-up banner + sound + vibration
    );
    chatCh.setDescription("Chat and group message notifications");
    chatCh.enableVibration(true);
    chatCh.setVibrationPattern(new long[]{0, 100, 80, 100});
    chatCh.enableLights(true);
    chatCh.setLightColor(0xFF3B82F6);           // brand blue
    chatCh.setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, messageAudio);
    nm.createNotificationChannel(chatCh);

    // ── o2o_bids — Bids & Offers (IMPORTANCE_HIGH) ───────────────────────────
    NotificationChannel bidCh = new NotificationChannel(
        "o2o_bids",
        "Bids & Offers",
        NotificationManager.IMPORTANCE_HIGH
    );
    bidCh.setDescription("Bid requests, offers, and auction results");
    bidCh.enableVibration(true);
    bidCh.setVibrationPattern(new long[]{0, 300, 150, 300, 150, 300});
    bidCh.enableLights(true);
    bidCh.setLightColor(0xFFF59E0B);            // amber
    bidCh.setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, alertAudio);
    nm.createNotificationChannel(bidCh);

    // ── o2o_orders — Orders (IMPORTANCE_HIGH) ────────────────────────────────
    NotificationChannel orderCh = new NotificationChannel(
        "o2o_orders",
        "Orders",
        NotificationManager.IMPORTANCE_HIGH
    );
    orderCh.setDescription("Order confirmations, updates, and deliveries");
    orderCh.enableVibration(true);
    orderCh.setVibrationPattern(new long[]{0, 250, 100, 250});
    orderCh.enableLights(true);
    orderCh.setLightColor(0xFF10B981);          // emerald
    orderCh.setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, alertAudio);
    nm.createNotificationChannel(orderCh);

    // ── o2o_social — Friend requests, mentions (IMPORTANCE_HIGH) ─────────────
    //
    // FIX: was IMPORTANCE_DEFAULT — heads-up banner was never shown.
    // Friend-request and friend-accepted notifications use this channel.
    // Sound was also missing — added now.
    NotificationChannel socialCh = new NotificationChannel(
        "o2o_social",
        "Social",
        NotificationManager.IMPORTANCE_HIGH     // FIX: was IMPORTANCE_DEFAULT
    );
    socialCh.setDescription("Friend requests, follows, and social activity");
    socialCh.enableVibration(true);
    socialCh.setVibrationPattern(new long[]{0, 200, 100, 200});
    socialCh.enableLights(true);
    socialCh.setLightColor(0xFF8B5CF6);         // purple
    socialCh.setSound(                          // FIX: was missing entirely
        android.provider.Settings.System.DEFAULT_NOTIFICATION_URI,
        alertAudio
    );
    nm.createNotificationChannel(socialCh);

    // ── o2o_calls — Calls (IMPORTANCE_HIGH, full-screen intent ready) ─────────
    NotificationChannel callsCh = new NotificationChannel(
        "o2o_calls",
        "Calls",
        NotificationManager.IMPORTANCE_HIGH
    );
    callsCh.setDescription("Incoming calls and call notifications");
    callsCh.enableVibration(true);
    callsCh.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000});
    callsCh.enableLights(true);
    callsCh.setLightColor(0xFF22C55E);          // green
    callsCh.setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, alertAudio);
    nm.createNotificationChannel(callsCh);

    // ── o2o_default — Fallback channel (IMPORTANCE_HIGH) ─────────────────────
    //
    // FIX: was IMPORTANCE_DEFAULT — any notification without an explicit channelId
    // (or with an unrecognised channelId) fell here and showed no heads-up banner.
    // Sound was also missing — added now.
    NotificationChannel defaultCh = new NotificationChannel(
        "o2o_default",
        "O2O Notifications",
        NotificationManager.IMPORTANCE_HIGH     // FIX: was IMPORTANCE_DEFAULT
    );
    defaultCh.setDescription("General O2O notifications");
    defaultCh.enableVibration(true);
    defaultCh.setVibrationPattern(new long[]{0, 250, 250, 250});
    defaultCh.enableLights(true);
    defaultCh.setLightColor(0xFF3B82F6);        // brand blue
    defaultCh.setSound(                         // FIX: was missing entirely
        android.provider.Settings.System.DEFAULT_NOTIFICATION_URI,
        alertAudio
    );
    nm.createNotificationChannel(defaultCh);
  }
}
