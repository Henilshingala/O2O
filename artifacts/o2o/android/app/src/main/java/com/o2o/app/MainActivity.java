package com.o2o.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {

  private static final String TAG = "O2O.MainActivity";

  /**
   * Returns the name of the main component registered from JavaScript.
   * This is used to schedule rendering of the component.
   * Must match AppRegistry.registerComponent("main", ...) in index.js.
   */
  @Override
  protected String getMainComponentName() {
    return "main";
  }

  /**
   * Called when the activity is first created.
   * Logs launch intent so we can verify FCM deep-link data is present.
   */
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    logIntent("onCreate", getIntent());
  }

  /**
   * Called when the activity receives a new Intent while already running
   * (i.e., app is in the background and user taps a notification).
   *
   * CRITICAL: Without this override, tapping a notification while the app is
   * backgrounded does NOT update the React Native intent, so deep-link data
   * from FCM notifications is silently lost. This is required for
   * onNotificationOpenedApp() to fire correctly in @react-native-firebase/messaging.
   */
  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent); // make getIntent() return the new intent in JS land
    logIntent("onNewIntent", intent);
  }

  /** Log intent extras for FCM deep-link debugging. */
  private void logIntent(String source, Intent intent) {
    if (intent == null) {
      Log.d(TAG, "[FCM] " + source + " — intent is null");
      return;
    }
    Bundle extras = intent.getExtras();
    if (extras == null || extras.isEmpty()) {
      Log.d(TAG, "[FCM] " + source + " — intent has no extras (normal cold start)");
      return;
    }
    StringBuilder sb = new StringBuilder();
    for (String key : extras.keySet()) {
      sb.append(key).append("=").append(extras.get(key)).append("; ");
    }
    Log.d(TAG, "[FCM] " + source + " extras: " + sb.toString());
  }
}
