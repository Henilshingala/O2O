import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";

export default function AdminManagement() {
  const { data: admins, isLoading } = useQuery({ queryKey: ["admin-list"], queryFn: () => api.get("/admins") });
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ username: "", fullName: "", email: "", password: "", adminRole: "admin", mobile: "", city: "" });
  const qc = useQueryClient();
  const { addToast } = useToast();

  const handleCreate = async () => {
    try {
      await api.post("/admins", form);
      addToast("Admin created", "success");
      setCreateOpen(false);
      setForm({ username: "", fullName: "", email: "", password: "", adminRole: "admin", mobile: "", city: "" });
      qc.invalidateQueries({ queryKey: ["admin-list"] });
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const toggleDisable = async (id: string, isBanned: boolean) => {
    try {
      await api.put(`/admins/${id}/${isBanned ? "enable" : "disable"}`);
      addToast(isBanned ? "Admin enabled" : "Admin disabled", "success");
      qc.invalidateQueries({ queryKey: ["admin-list"] });
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const changeRole = async (id: string, role: string) => {
    try {
      await api.put(`/admins/${id}/role`, { adminRole: role });
      addToast("Role changed", "success");
      qc.invalidateQueries({ queryKey: ["admin-list"] });
    } catch (e: any) { addToast(e.message, "error"); }
  };

  if (isLoading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><h1 className="page-title">Admin Management</h1><p className="page-subtitle">Super Admin Only</p></div>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>+ Create Admin</button>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {(admins || []).map((a: any) => (
              <tr key={a.id}>
                <td>{a.fullName || a.full_name}</td>
                <td>{a.email}</td>
                <td>
                  <select value={a.adminRole || a.admin_role || "admin"} onChange={(e) => changeRole(a.id, e.target.value)} style={{ width: "auto", padding: "4px 8px" }}>
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                    <option value="support">Support</option>
                  </select>
                </td>
                <td><span className={`badge ${a.isBanned || a.is_banned ? "badge-red" : "badge-green"}`}>{a.isBanned || a.is_banned ? "Disabled" : "Active"}</span></td>
                <td>
                  <button className={`btn btn-sm ${a.isBanned || a.is_banned ? "btn-success" : "btn-danger"}`} onClick={() => toggleDisable(a.id, a.isBanned || a.is_banned)}>
                    {a.isBanned || a.is_banned ? "Enable" : "Disable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Admin">
        <div className="form-row">
          <div className="form-group"><label className="form-label">Username</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Full Name</label><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
        </div>
        <div className="form-group"><label className="form-label">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Password</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Admin Role</label>
          <select value={form.adminRole} onChange={(e) => setForm({ ...form, adminRole: e.target.value })}>
            <option value="admin">Admin</option><option value="moderator">Moderator</option><option value="support">Support</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={handleCreate}>Create Admin</button>
      </Modal>
    </div>
  );
}
