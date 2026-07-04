import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api } from "../api/client";

interface AdminUser { userId: string; email: string; fullName: string; role: string; adminRole: string; avatar?: string; }
interface AuthCtx { user: AdminUser | null; token: string | null; login: (email: string, password: string) => Promise<void>; logout: () => void; loading: boolean; }

const AuthContext = createContext<AuthCtx>({ user: null, token: null, login: async () => {}, logout: () => {}, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("admin_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get("/auth/me").then((u) => { setUser({ userId: u.id, email: u.email, fullName: u.fullName || u.full_name, role: u.role, adminRole: u.adminRole || u.admin_role || "admin", avatar: u.avatar }); }).catch(() => { setToken(null); localStorage.removeItem("admin_token"); }).finally(() => setLoading(false));
    } else { setLoading(false); }
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    localStorage.setItem("admin_token", res.token);
    setToken(res.token);
    setUser({ userId: res.user.id, email: res.user.email, fullName: res.user.fullName || res.user.full_name, role: res.user.role, adminRole: res.user.adminRole || res.user.admin_role || "admin", avatar: res.user.avatar });
  };

  const logout = () => { localStorage.removeItem("admin_token"); setToken(null); setUser(null); api.post("/auth/logout").catch(() => {}); };

  return <AuthContext.Provider value={{ user, token, login, logout, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
