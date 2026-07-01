import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@/types";
import { customFetch, setAuthTokenGetter, setTokenRefreshHandler } from "@workspace/api-client-react";

const TOKEN_KEY = "@o2o_token";
const REFRESH_KEY = "@o2o_refresh_token";

async function clearStoredTokens() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(REFRESH_KEY);
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: Omit<User, "id" | "createdAt">) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  sendOtp: (email: string) => Promise<{ success: boolean; otp?: string; error?: string }>;
  verifyOtp: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  getUserById: (id: string) => User | undefined;
  cacheUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function storeTokens(token: string, refreshToken?: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) await AsyncStorage.setItem(REFRESH_KEY, refreshToken);
}

setAuthTokenGetter(async () => AsyncStorage.getItem(TOKEN_KEY));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userCache, setUserCache] = useState<Record<string, User>>({});
  const pendingFetches = useRef(new Set<string>());
  const refreshPromise = useRef<Promise<string | null> | null>(null);

  const cacheUser = useCallback((u: User) => {
    setUserCache((prev) => ({ ...prev, [u.id]: u }));
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (refreshPromise.current) return refreshPromise.current;
    refreshPromise.current = (async () => {
      try {
        const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
        if (!refreshToken) return null;
        const data = await customFetch<any>("/api/auth/refresh", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
          headers: { "x-retry": "1" },
        });
        await storeTokens(data.token, data.refreshToken);
        if (data.user) {
          setUser(data.user);
          cacheUser(data.user);
        }
        return data.token as string;
      } catch {
        await clearStoredTokens();
        setUser(null);
        return null;
      } finally {
        refreshPromise.current = null;
      }
    })();
    return refreshPromise.current;
  }, [cacheUser]);

  useEffect(() => {
    setTokenRefreshHandler(refreshAccessToken);
    return () => setTokenRefreshHandler(null);
  }, [refreshAccessToken]);

  const fetchCurrentUser = async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        const userData = await customFetch<User>("/api/auth/me");
        setUser(userData);
        cacheUser(userData);
      }
    } catch {
      const newToken = await refreshAccessToken();
      if (newToken) {
        try {
          const userData = await customFetch<User>("/api/auth/me");
          setUser(userData);
          cacheUser(userData);
        } catch {
          await clearStoredTokens();
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const data = await customFetch<any>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      await storeTokens(data.token, data.refreshToken);
      setUser(data.user);
      cacheUser(data.user);
      return { success: true };
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || "Network error";
      return { success: false, error: msg };
    }
  }, [cacheUser]);

  const signup = useCallback(async (data: Omit<User, "id" | "createdAt">) => {
    try {
      const resData = await customFetch<any>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
      });
      await storeTokens(resData.token, resData.refreshToken);
      setUser(resData.user);
      cacheUser(resData.user);
      return { success: true };
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || "Network error";
      return { success: false, error: msg };
    }
  }, [cacheUser]);

  const logout = useCallback(async () => {
    try {
      const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
      await customFetch("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // ignore logout errors
    }
    setUser(null);
    setUserCache({});
    await clearStoredTokens();
  }, []);

  const sendOtp = useCallback(async (email: string) => {
    try {
      const data = await customFetch<any>("/api/auth/send-otp", { method: "POST", body: JSON.stringify({ email }) });
      return { success: true, otp: data.otp };
    } catch (e: any) { return { success: false, error: e?.data?.error || "Network error" }; }
  }, []);

  const verifyOtp = useCallback(async (email: string, otp: string) => {
    try {
      await customFetch<any>("/api/auth/verify-otp", { method: "POST", body: JSON.stringify({ email, otp }) });
      return { success: true };
    } catch (e: any) { return { success: false, error: e?.data?.error || "Network error" }; }
  }, []);

  const resetPassword = useCallback(async (email: string, password: string) => {
    try {
      await customFetch<any>("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ email, password }) });
      return { success: true };
    } catch (e: any) { return { success: false, error: e?.data?.error || "Network error" }; }
  }, []);

  const getUserById = useCallback((id: string) => {
    if (!id) return undefined;
    if (userCache[id]) return userCache[id];
    if (!pendingFetches.current.has(id)) {
      pendingFetches.current.add(id);
      customFetch<User>(`/api/users/${id}`)
        .then((u) => cacheUser(u))
        .catch(() => {})
        .finally(() => pendingFetches.current.delete(id));
    }
    return userCache[id];
  }, [userCache, cacheUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signup,
        logout,
        sendOtp,
        verifyOtp,
        resetPassword,
        getUserById,
        cacheUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
