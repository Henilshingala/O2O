import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "../api/client";

export default function DatabaseBrowser() {
  const { data: tables, isLoading } = useQuery({ queryKey: ["db-tables"], queryFn: () => api.get("/db/tables") });
  const [search, setSearch] = useState("");

  const filtered = (tables || []).filter((t: any) => t.label.toLowerCase().includes(search.toLowerCase()) || t.name.includes(search.toLowerCase()));

  if (isLoading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Database Browser</h1>
        <p className="page-subtitle">Browse and manage all {tables?.length || 0} tables</p>
      </div>
      <div style={{ marginBottom: 16 }}>
        <input placeholder="Search tables..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 400 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {filtered.map((t: any) => (
          <Link key={t.name} href={`/database/${t.name}`}>
            <div className="card" style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: ".95rem" }}>{t.label}</div>
                  <div style={{ fontSize: ".8rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{t.name}</div>
                </div>
                <div className="badge badge-purple">{t.count} rows</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
