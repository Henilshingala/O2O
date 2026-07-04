import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";

export default function Users() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [banModal, setBanModal] = useState<any>(null);
  const [banReason, setBanReason] = useState("");
  const [resetModal, setResetModal] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const qc = useQueryClient();
  const { addToast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, search, roleFilter],
    queryFn: () => api.get(`/users?page=${page}&limit=25&search=${search}&role=${roleFilter}`),
  });

  const { data: detail } = useQuery({
    queryKey: ["admin-user-detail", selectedUser],
    queryFn: () => api.get(`/users/${selectedUser}`),
    enabled: !!selectedUser,
  });

  const columns = [
    { key: "username", label: "Username" },
    { key: "full_name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "role", label: "Role", render: (v: string) => <span className={`badge badge-${v === "admin" ? "purple" : v === "seller" ? "green" : "blue"}`}>{v}</span> },
    { key: "is_banned", label: "Status", render: (v: boolean) => <span className={`badge ${v ? "badge-red" : "badge-green"}`}>{v ? "Banned" : "Active"}</span> },
    { key: "created_at", label: "Joined", render: (v: string) => new Date(v).toLocaleDateString() },
  ];

  const handleBan = async () => {
    try {
      await api.post(`/users/${banModal.id}/ban`, { reason: banReason });
      addToast("User banned", "success");
      setBanModal(null); setBanReason("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const handleUnban = async (id: string) => {
    try {
      await api.post(`/users/${id}/unban`);
      addToast("User unbanned", "success");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const handleVerify = async (id: string) => {
    try {
      await api.post(`/users/${id}/verify-seller`);
      addToast("Seller verified", "success");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const handleResetPw = async () => {
    try {
      await api.post(`/users/${resetModal.id}/reset-password`, { newPassword });
      addToast("Password reset", "success");
      setResetModal(null); setNewPassword("");
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this user?")) return;
    try {
      await api.del(`/users/${id}`);
      addToast("User deleted", "success");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { addToast(e.message, "error"); }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">User Management</h1>
        <p className="page-subtitle">Manage all marketplace users</p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["", "buyer", "seller", "admin"].map((r) => (
          <button key={r} className={`btn btn-sm ${roleFilter === r ? "btn-primary" : "btn-ghost"}`} onClick={() => { setRoleFilter(r); setPage(1); }}>
            {r || "All"}
          </button>
        ))}
      </div>

      <div className="card">
        <DataTable columns={columns} data={data?.users || []} total={data?.total || 0} page={page} totalPages={data?.totalPages || 1}
          onPageChange={setPage} onSearch={(q) => { setSearch(q); setPage(1); }} loading={isLoading}
          actions={(row) => (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedUser(row.id)}>View</button>
              {row.is_banned ? <button className="btn btn-success btn-sm" onClick={() => handleUnban(row.id)}>Unban</button>
                : <button className="btn btn-danger btn-sm" onClick={() => setBanModal(row)}>Ban</button>}
              {row.role === "seller" && !row.is_verified_seller && <button className="btn btn-primary btn-sm" onClick={() => handleVerify(row.id)}>Verify</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => setResetModal(row)}>Reset PW</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(row.id)}>Del</button>
            </div>
          )}
        />
      </div>

      <Modal open={!!selectedUser && !!detail} onClose={() => setSelectedUser(null)} title="User Detail">
        {detail?.user && (
          <div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Username</label><div>{detail.user.username}</div></div>
              <div className="form-group"><label className="form-label">Full Name</label><div>{detail.user.full_name || detail.user.fullName}</div></div>
              <div className="form-group"><label className="form-label">Email</label><div>{detail.user.email}</div></div>
              <div className="form-group"><label className="form-label">Role</label><div>{detail.user.role}</div></div>
            </div>
            {detail.loginHistory?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4>Login History</h4>
                <div className="table-responsive">
                <table><thead><tr><th>IP</th><th>Device</th><th>Time</th></tr></thead>
                  <tbody>{detail.loginHistory.slice(0, 10).map((l: any) => <tr key={l.id}><td>{l.ip_address || l.ipAddress}</td><td>{l.device}</td><td>{new Date(l.timestamp).toLocaleString()}</td></tr>)}</tbody>
                </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!banModal} onClose={() => setBanModal(null)} title="Ban User">
        <p>Ban <strong>{banModal?.username}</strong>?</p>
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Reason</label>
          <input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Reason for ban" />
        </div>
        <button className="btn btn-danger" onClick={handleBan}>Confirm Ban</button>
      </Modal>

      <Modal open={!!resetModal} onClose={() => setResetModal(null)} title="Reset Password">
        <p>Reset password for <strong>{resetModal?.username}</strong></p>
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">New Password</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
        </div>
        <button className="btn btn-primary" onClick={handleResetPw}>Reset Password</button>
      </Modal>
    </div>
  );
}
