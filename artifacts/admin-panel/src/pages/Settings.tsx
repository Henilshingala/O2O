import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";

export default function Settings() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.adminRole === "super_admin";

  // Password change form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.post("/auth/change-password", data),
    onSuccess: () => {
      addToast("Password changed successfully", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => addToast(err.message, "error"),
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      addToast("Passwords do not match", "error");
      return;
    }
    if (newPassword.length < 8) {
      addToast("Password must be at least 8 characters", "error");
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  // App config (super admin only)
  const { data: appConfig } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => api.get("/dashboard/config"),
    enabled: isSuperAdmin,
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="page-description">Manage your account and system configuration</p>
        </div>
      </div>

      {/* Account Info Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Account Information</h3>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
            <div>
              <div style={{ fontSize: ".8rem", color: "var(--text-muted)", marginBottom: 4 }}>Full Name</div>
              <div style={{ fontWeight: 600 }}>{user?.fullName}</div>
            </div>
            <div>
              <div style={{ fontSize: ".8rem", color: "var(--text-muted)", marginBottom: 4 }}>Email</div>
              <div style={{ fontWeight: 600 }}>{user?.email}</div>
            </div>
            <div>
              <div style={{ fontSize: ".8rem", color: "var(--text-muted)", marginBottom: 4 }}>Role</div>
              <div className="admin-badge">{user?.adminRole?.replace("_", " ")}</div>
            </div>
            <div>
              <div style={{ fontSize: ".8rem", color: "var(--text-muted)", marginBottom: 4 }}>User ID</div>
              <div style={{ fontFamily: "monospace", fontSize: ".85rem" }}>{user?.userId}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Change Password</h3>
        </div>
        <form onSubmit={handleChangePassword} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
          <div>
            <label className="input-label">Current Password</label>
            <input
              type="password"
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="input-label">New Password</label>
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="input-label">Confirm New Password</label>
            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={changePasswordMutation.isPending}>
            {changePasswordMutation.isPending ? "Changing…" : "Change Password"}
          </button>
        </form>
      </div>

      {/* System Info Card (super admin only) */}
      {isSuperAdmin && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3 className="card-title">System Information</h3>
          </div>
          <div style={{ padding: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
              <div>
                <div style={{ fontSize: ".8rem", color: "var(--text-muted)", marginBottom: 4 }}>Platform</div>
                <div style={{ fontWeight: 600 }}>O2O Marketplace</div>
              </div>
              <div>
                <div style={{ fontSize: ".8rem", color: "var(--text-muted)", marginBottom: 4 }}>Backend</div>
                <div style={{ fontWeight: 600 }}>Express + Drizzle ORM</div>
              </div>
              <div>
                <div style={{ fontSize: ".8rem", color: "var(--text-muted)", marginBottom: 4 }}>Database</div>
                <div style={{ fontWeight: 600 }}>PostgreSQL (Neon)</div>
              </div>
              <div>
                <div style={{ fontSize: ".8rem", color: "var(--text-muted)", marginBottom: 4 }}>Admin Panel</div>
                <div style={{ fontWeight: 600 }}>React + Vite SPA</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      {isSuperAdmin && (
        <div className="card" style={{ borderColor: "var(--danger)" }}>
          <div className="card-header" style={{ borderBottomColor: "rgba(239,68,68,.2)" }}>
            <h3 className="card-title" style={{ color: "var(--danger)" }}>⚠️ Danger Zone</h3>
          </div>
          <div style={{ padding: 24 }}>
            <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
              These actions are irreversible. Only Super Admins can access this section.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                className="btn"
                style={{ background: "rgba(239,68,68,.15)", color: "var(--danger)", border: "1px solid rgba(239,68,68,.3)" }}
                onClick={() => {
                  if (confirm("Are you sure you want to clear all audit logs?")) {
                    api.del("/audit-logs/clear").then(() => {
                      addToast("Audit logs cleared", "success");
                      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
                    }).catch((err: Error) => addToast(err.message, "error"));
                  }
                }}
              >
                Clear Audit Logs
              </button>
              <button
                className="btn"
                style={{ background: "rgba(239,68,68,.15)", color: "var(--danger)", border: "1px solid rgba(239,68,68,.3)" }}
                onClick={() => {
                  if (confirm("This will invalidate all active admin sessions (except yours). Continue?")) {
                    api.post("/auth/invalidate-sessions").then(() => {
                      addToast("All other admin sessions invalidated", "success");
                    }).catch((err: Error) => addToast(err.message, "error"));
                  }
                }}
              >
                Invalidate All Sessions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
