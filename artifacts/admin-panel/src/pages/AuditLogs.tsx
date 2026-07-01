import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [actionFilter, setActionFilter] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["audit-logs", page, limit, actionFilter], queryFn: () => api.get(`/audit-logs?page=${page}&limit=${limit}&action=${actionFilter}`) });
  const { data: actions } = useQuery({ queryKey: ["audit-actions"], queryFn: () => api.get("/audit-logs/actions") });

  if (isLoading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Audit Logs</h1>
        <p className="page-subtitle">Every admin action is recorded</p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} style={{ width: "auto" }}>
          <option value="">All Actions</option>
          {(actions || []).map((a: string) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} style={{ width: "auto" }}>
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
        <span style={{ color: "var(--text-muted)", alignSelf: "center" }}>{data?.total || 0} total logs</span>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table>
          <thead><tr><th>Admin</th><th>Action</th><th>Target</th><th>IP</th><th>Browser</th><th>Time</th></tr></thead>
          <tbody>
            {(data?.logs || []).map((l: any) => (
              <tr key={l.id}>
                <td>{l.admin_name || l.admin_username || l.admin_id}</td>
                <td><span className="badge badge-purple">{l.action}</span></td>
                <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{l.target}</td>
                <td>{l.ip_address || l.ipAddress || "-"}</td>
                <td style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{l.browser || "-"}</td>
                <td>{new Date(l.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {(data?.totalPages || 1) > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
            <span style={{ color: "var(--text-muted)" }}>Page {page} of {data?.totalPages}</span>
            <button disabled={page >= (data?.totalPages || 1)} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
