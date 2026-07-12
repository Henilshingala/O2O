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
   * Channels are permanent once created — the system ignores updates to
   * importance/sound/vibration after the first install. Users can customise
   * each channel individually in Settings → App info → Notifications.
   *
   * Required: Android 8.0+ (API 26+). Safe no-op on older versions.
   */
  private void createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

    NotificationManager nm = getSystemService(NotificationManager.class);
    if (nm == null) return;

    AudioAttributes messageAudio = new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build();

    AudioAttributes alertAudio = new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build();

    // ── o2o_chat — Messages (IMPORTANCE_HIGH = heads-up banner) ───────────────
    NotificationChannel chatCh = new NotificationChannel(
        "o2o_chat",
        "Messages",
        NotificationManager.IMPORTANCE_HIGH     // shows heads-up banner + sound
    );
    chatCh.setDescription("Chat and group message notifications");
    chatCh.enableVibration(true);
    chatCh.setVibrationPattern(new long[]{0, 100, 80, 100});
    chatCh.enableLights(true);
    chatCh.setLightColor(0xFF3B82F6);           // brand blue
    chatCh.setAudioAttributes(messageAudio);
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
    bidCh.setAudioAttributes(alertAudio);
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
    orderCh.setAudioAttributes(alertAudio);
    nm.createNotificationChannel(orderCh);

    // ── o2o_social — Friend requests, mentions (IMPORTANCE_DEFAULT) ───────────
    NotificationChannel socialCh = new NotificationChannel(
        "o2o_social",
        "Social",
        NotificationManager.IMPORTANCE_DEFAULT  // no heads-up; shows in shade
    );
    socialCh.setDescription("Friend requests, follows, and social activity");
    socialCh.enableVibration(true);
    socialCh.setVibrationPattern(new long[]{0, 200});
    socialCh.enableLights(true);
    socialCh.setLightColor(0xFF8B5CF6);         // purple
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
    callsCh.setAudioAttributes(alertAudio);
    nm.createNotificationChannel(callsCh);

    // ── o2o_default — Fallback channel (IMPORTANCE_DEFAULT) ──────────────────
    NotificationChannel defaultCh = new NotificationChannel(
        "o2o_default",
        "O2O Notifications",
        NotificationManager.IMPORTANCE_DEFAULT
    );
    defaultCh.setDescription("General O2O notifications");
    defaultCh.enableVibration(true);
    defaultCh.setVibrationPattern(new long[]{0, 250, 250, 250});
    defaultCh.enableLights(true);
    nm.createNotificationChannel(defaultCh);
  }
}
