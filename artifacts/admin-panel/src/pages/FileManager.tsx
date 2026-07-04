import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useToast } from "../hooks/useToast";

export default function FileManager() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ["admin-files", page], queryFn: () => api.get(`/files?page=${page}&limit=25`) });
  const { data: stats } = useQuery({ queryKey: ["file-stats"], queryFn: () => api.get("/files/stats") });
  const qc = useQueryClient();
  const { addToast } = useToast();

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this file?")) return;
    try {
      await api.del(`/files/${id}`);
      addToast("File deleted", "success");
      qc.invalidateQueries({ queryKey: ["admin-files"] });
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (isLoading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">File Manager</h1>
        <p className="page-subtitle">Total storage: {formatSize(data?.totalStorage || 0)} · {data?.total || 0} files</p>
      </div>

      {stats?.typeStats && (
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          {stats.typeStats.map((s: any) => (
            <div className="card stat-card" key={s.type}>
              <div className="stat-icon blue">📄</div>
              <div><div className="stat-value">{s.count}</div><div className="stat-label">{s.type} files ({formatSize(s.total_size)})</div></div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table>
          <thead><tr><th>URL</th><th>Type</th><th>Size</th><th>Uploader</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            {(data?.files || []).map((f: any) => (
              <tr key={f.id}>
                <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>{f.url}</td>
                <td><span className="badge badge-blue">{f.type}</span></td>
                <td>{formatSize(f.size)}</td>
                <td>{f.uploader_id || f.uploaderId}</td>
                <td>{new Date(f.timestamp).toLocaleDateString()}</td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <a href={f.url} target="_blank" className="btn btn-ghost btn-sm" rel="noreferrer">Preview</a>
                    <a href={f.url} download className="btn btn-ghost btn-sm">Download</a>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(f.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
