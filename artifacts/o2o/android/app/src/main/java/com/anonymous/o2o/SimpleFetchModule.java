package com.anonymous.o2o;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableMapKeySetIterator;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class SimpleFetchModule extends ReactContextBaseJavaModule {
    public SimpleFetchModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "SimpleFetch";
    }

    @ReactMethod
    public void fetch(String urlString, String method, ReadableMap headers, String body, Promise promise) {
        new Thread(() -> {
            try {
                URL url = new URL(urlString);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod(method);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);

                if (headers != null) {
                    ReadableMapKeySetIterator iterator = headers.keySetIterator();
                    while (iterator.hasNextKey()) {
                        String key = iterator.nextKey();
                        conn.setRequestProperty(key, headers.getString(key));
                    }
                }

                if (body != null && !body.isEmpty()) {
                    conn.setDoOutput(true);
                    try (OutputStream os = conn.getOutputStream()) {
                        byte[] input = body.getBytes("utf-8");
                        os.write(input, 0, input.length);
                    }
                }

                int statusCode = conn.getResponseCode();
                
                BufferedReader br;
                if (200 <= statusCode && statusCode <= 299) {
                    br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "utf-8"));
                } else {
                    br = new BufferedReader(new InputStreamReader(conn.getErrorStream(), "utf-8"));
                }
                
                StringBuilder response = new StringBuilder();
                String responseLine;
                while ((responseLine = br.readLine()) != null) {
                    response.append(responseLine.trim());
                }
                
                promise.resolve("{\"status\":" + statusCode + ", \"data\":\"" + response.toString().replace("\"", "\\\"") + "\"}");

            } catch (Exception e) {
                promise.reject("FETCH_ERROR", e.getMessage());
            }
        }).start();
    }
}
