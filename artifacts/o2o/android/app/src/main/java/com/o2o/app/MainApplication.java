package com.o2o.app;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.os.Build;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.PackageList;
import com.facebook.soloader.SoLoader;
import java.util.Arrays;
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
          // Packages that cannot be autolinked yet can be added manually here, for example:
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
   * Create Android notification channels for FCM.
   * Required on Android 8+ (API 26+). Safe to call on older versions.
   *
   * Channel IDs must match the channelId values sent from the backend FCM payload.
   */
  private void createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

    NotificationManager nm = getSystemService(NotificationManager.class);
    if (nm == null) return;

    AudioAttributes audioAttr = new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build();

    // ── Default channel ───────────────────────────────────────────────────────
    NotificationChannel defaultCh = new NotificationChannel(
        "o2o_default",
        "O2O Notifications",
        NotificationManager.IMPORTANCE_HIGH
    );
    defaultCh.setDescription("General O2O app notifications");
    defaultCh.enableVibration(true);
    defaultCh.setVibrationPattern(new long[]{0, 250, 250, 250});
    defaultCh.enableLights(true);
    nm.createNotificationChannel(defaultCh);

    // ── Chat messages ─────────────────────────────────────────────────────────
    NotificationChannel chatCh = new NotificationChannel(
        "o2o_chat",
        "Messages",
        NotificationManager.IMPORTANCE_HIGH
    );
    chatCh.setDescription("Chat and group message notifications");
    chatCh.enableVibration(true);
    chatCh.setVibrationPattern(new long[]{0, 100, 100, 100});
    chatCh.enableLights(true);
    nm.createNotificationChannel(chatCh);

    // ── Bids ──────────────────────────────────────────────────────────────────
    NotificationChannel bidCh = new NotificationChannel(
        "o2o_bids",
        "Bids & Offers",
        NotificationManager.IMPORTANCE_HIGH
    );
    bidCh.setDescription("Bid requests, offers, and results");
    bidCh.enableVibration(true);
    bidCh.setVibrationPattern(new long[]{0, 300, 200, 300});
    bidCh.enableLights(true);
    nm.createNotificationChannel(bidCh);

    // ── Orders ────────────────────────────────────────────────────────────────
    NotificationChannel orderCh = new NotificationChannel(
        "o2o_orders",
        "Orders",
        NotificationManager.IMPORTANCE_HIGH
    );
    orderCh.setDescription("Order confirmations and status updates");
    orderCh.enableVibration(true);
    nm.createNotificationChannel(orderCh);

    // ── Social (friend requests, group invites) ────────────────────────────────
    NotificationChannel socialCh = new NotificationChannel(
        "o2o_social",
        "Social",
        NotificationManager.IMPORTANCE_DEFAULT
    );
    socialCh.setDescription("Friend requests and social notifications");
    socialCh.enableVibration(true);
    nm.createNotificationChannel(socialCh);
  }
}
