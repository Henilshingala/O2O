import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { api } from "../api/client";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";

export default function DatabaseTable() {
  const [, params] = useRoute("/database/:table");
  const table = params?.table || "";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [editRow, setEditRow] = useState<any>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createData, setCreateData] = useState<Record<string, string>>({});
  const qc = useQueryClient();
  const { addToast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["db-table", table, page, search, sortBy, sortOrder],
    queryFn: () => api.get(`/db/${table}?page=${page}&limit=25&search=${search}&sortBy=${sortBy}&sortOrder=${sortOrder}`),
    enabled: !!table,
  });

  const columns = (data?.columns || []).map((c: any) => ({ key: c.column_name, label: c.column_name, }));

  const handleSort = (col: string) => {
    if (sortBy === col) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortOrder("asc"); }
  };

  const handleDelete = async (row: any) => {
    if (!confirm("Delete this record?")) return;
    const pk = data?.primaryKey;
    const id = typeof pk === "string" ? row[pk] : row[pk?.[0]];
    try {
      await api.del(`/db/${table}/${id}`);
      addToast("Record deleted", "success");
      qc.invalidateQueries({ queryKey: ["db-table", table] });
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const handleEdit = (row: any) => {
    setEditRow(row);
    const d: Record<string, string> = {};
    for (const c of columns) d[c.key] = row[c.key] === null ? "" : typeof row[c.key] === "object" ? JSON.stringify(row[c.key]) : String(row[c.key]);
    setEditData(d);
  };

  const saveEdit = async () => {
    const pk = data?.primaryKey;
    const id = typeof pk === "string" ? editRow[pk] : editRow[pk?.[0]];
    try {
      const parsed: Record<string, any> = {};
      for (const [k, v] of Object.entries(editData)) {
        if (v === "") { parsed[k] = null; continue; }
        try { parsed[k] = JSON.parse(v); } catch { parsed[k] = v; }
      }
      await api.put(`/db/${table}/${id}`, parsed);
      addToast("Record updated", "success");
      setEditRow(null);
      qc.invalidateQueries({ queryKey: ["db-table", table] });
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const saveCreate = async () => {
    try {
      const parsed: Record<string, any> = {};
      for (const [k, v] of Object.entries(createData)) {
        if (v === "") continue;
        try { parsed[k] = JSON.parse(v); } catch { parsed[k] = v; }
      }
      await api.post(`/db/${table}`, parsed);
      addToast("Record created", "success");
      setCreateOpen(false);
      setCreateData({});
      qc.invalidateQueries({ queryKey: ["db-table", table] });
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const exportData = (format: string) => { window.open(`${window.location.origin}/api/admin/db/${table}/export/${format}`, "_blank"); };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <Link href="/database"><span className="btn btn-ghost btn-sm">← Back</span></Link>
          <h1 className="page-title">{data?.label || table}</h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-sm" onClick={() => { setCreateOpen(true); const d: Record<string, string> = {}; columns.forEach((c: any) => d[c.key] = ""); setCreateData(d); }}>+ New Record</button>
          <button className="btn btn-ghost btn-sm" onClick={() => exportData("csv")}>Export CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={() => exportData("json")}>Export JSON</button>
        </div>
      </div>

      <div className="card">
        <DataTable columns={columns} data={data?.rows || []} total={data?.total || 0} page={page} totalPages={data?.totalPages || 1}
          onPageChange={setPage} onSearch={(q) => { setSearch(q); setPage(1); }} onSort={handleSort} sortBy={sortBy} sortOrder={sortOrder} loading={isLoading}
          actions={(row) => (
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(row)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(row)}>Del</button>
            </div>
          )}
        />
      </div>

      <Modal open={!!editRow} onClose={() => setEditRow(null)} title="Edit Record">
        {editRow && columns.map((c: any) => (
          <div className="form-group" key={c.key}>
            <label className="form-label">{c.key}</label>
            <input value={editData[c.key] || ""} onChange={(e) => setEditData({ ...editData, [c.key]: e.target.value })} />
          </div>
        ))}
        <button className="btn btn-primary" onClick={saveEdit}>Save Changes</button>
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Record">
        {columns.map((c: any) => (
          <div className="form-group" key={c.key}>
            <label className="form-label">{c.key}</label>
            <input value={createData[c.key] || ""} onChange={(e) => setCreateData({ ...createData, [c.key]: e.target.value })} />
          </div>
        ))}
        <button className="btn btn-primary" onClick={saveCreate}>Create</button>
      </Modal>
    </div>
  );
}
