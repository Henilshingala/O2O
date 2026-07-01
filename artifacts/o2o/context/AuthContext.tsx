import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@/types";
import { customFetch, setAuthTokenGetter } from "@workspace/api-client-react";

const TOKEN_KEY = "@o2o_token";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: Omit<User, "id" | "createdAt">) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  // TODO: implement real OTP flows when backend is ready for it
  sendOtp: (email: string) => Promise<{ success: boolean; otp?: string; error?: string }>;
  verifyOtp: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  getUserById: (id: string) => User | undefined;
  getFriends: () => User[];
}

const AuthContext = createContext<AuthContextType | null>(null);

setAuthTokenGetter(async () => {
  return await AsyncStorage.getItem(TOKEN_KEY);
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        const userData = await customFetch<User>("/api/auth/me"); 
        setUser(userData);
      }
    } catch (err) {
      console.error("fetchCurrentUser error:", err);
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
      
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      return { success: true };
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || "Network error";
      return { success: false, error: msg };
    }
  }, []);

  const signup = useCallback(async (data: Omit<User, "id" | "createdAt">) => {
    try {
      const resData = await customFetch<any>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
      });
      
      await AsyncStorage.setItem(TOKEN_KEY, resData.token);
      setUser(resData.user);
      return { success: true };
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || "Network error";
      return { success: false, error: msg };
    }
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    await AsyncStorage.removeItem(TOKEN_KEY);
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
    } catch (e) { return { success: false, error: "Network error" }; }
  }, []);
  
  const resetPassword = useCallback(async (email: string, password: string) => {
    try {
      await customFetch<any>("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ email, password }) });
      return { success: true };
    } catch (e) { return { success: false, error: "Network error" }; }
  }, []);

  const getUserById = useCallback((id: string) => {
    // Stub for now until backend user profile lookup is implemented for frontend
    return { id, username: "user_" + id, fullName: "User " + id, email: "", mobile: "", city: "", role: "buyer" } as User;
  }, []);

  const getFriends = useCallback(() => {
    return [];
  }, []);

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
        getFriends,
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
