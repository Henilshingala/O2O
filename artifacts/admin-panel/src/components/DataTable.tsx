import React, { useState } from "react";

interface Column { key: string; label: string; render?: (value: any, row: any) => React.ReactNode; }
interface DataTableProps {
  columns: Column[]; data: any[]; total: number; page: number; totalPages: number;
  onPageChange: (page: number) => void; onSearch?: (q: string) => void;
  onSort?: (col: string) => void; sortBy?: string; sortOrder?: string;
  loading?: boolean; actions?: (row: any) => React.ReactNode;
  bulkActions?: { label: string; onClick: (ids: string[]) => void; variant?: string }[];
  idKey?: string;
}

export default function DataTable({ columns, data, total, page, totalPages, onPageChange, onSearch, onSort, sortBy, sortOrder, loading, actions, bulkActions, idKey = "id" }: DataTableProps) {
  const [searchVal, setSearchVal] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleAll = () => {
    if (selected.size === data.length) setSelected(new Set());
    else setSelected(new Set(data.map((r) => r[idKey])));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  return (
    <div>
      <div className="table-controls">
        {onSearch && (
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Search..." value={searchVal} onChange={(e) => setSearchVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSearch(searchVal)} style={{ maxWidth: 300 }} />
            <button className="btn btn-ghost btn-sm" onClick={() => onSearch(searchVal)}>Search</button>
          </div>
        )}
        <div className="table-actions">
          {bulkActions && selected.size > 0 && bulkActions.map((a) => (
            <button key={a.label} className={`btn btn-sm ${a.variant || "btn-ghost"}`} onClick={() => { a.onClick(Array.from(selected)); setSelected(new Set()); }}>{a.label} ({selected.size})</button>
          ))}
          <span style={{ color: "var(--text-muted)", fontSize: ".85rem" }}>{total} records</span>
        </div>
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                {bulkActions && <th style={{ width: 40 }}><input type="checkbox" checked={selected.size === data.length && data.length > 0} onChange={toggleAll} /></th>}
                {columns.map((c) => (
                  <th key={c.key} style={{ cursor: onSort ? "pointer" : "default" }} onClick={() => onSort && onSort(c.key)}>
                    {c.label} {sortBy === c.key ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                  </th>
                ))}
                {actions && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={columns.length + (actions ? 1 : 0) + (bulkActions ? 1 : 0)} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No records found</td></tr>
              ) : data.map((row, i) => (
                <tr key={row[idKey] || i}>
                  {bulkActions && <td><input type="checkbox" checked={selected.has(row[idKey])} onChange={() => toggleOne(row[idKey])} /></td>}
                  {columns.map((c) => <td key={c.key}>{c.render ? c.render(row[c.key], row) : (row[c.key] === null ? <span style={{ color: "var(--text-muted)" }}>null</span> : typeof row[c.key] === "object" ? JSON.stringify(row[c.key]).slice(0, 60) : String(row[c.key] ?? "").slice(0, 80))}</td>)}
                  {actions && <td>{actions(row)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>← Prev</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
            return <button key={p} className={p === page ? "active" : ""} onClick={() => onPageChange(p)}>{p}</button>;
          })}
          <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
