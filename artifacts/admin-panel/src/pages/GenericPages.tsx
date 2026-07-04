import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import DataTable from "../components/DataTable";

function GenericTablePage({ table, title, subtitle, extraColumns }: { table: string; title: string; subtitle: string; extraColumns?: { key: string; label: string; render?: (v: any, r: any) => React.ReactNode }[] }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data, isLoading } = useQuery({
    queryKey: ["db-table", table, page, search, sortBy, sortOrder],
    queryFn: () => api.get(`/db/${table}?page=${page}&limit=25&search=${search}&sortBy=${sortBy}&sortOrder=${sortOrder}`),
  });

  const columns = extraColumns || (data?.columns || []).map((c: any) => ({ key: c.column_name, label: c.column_name }));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <div className="card">
        <DataTable columns={columns} data={data?.rows || []} total={data?.total || 0} page={page} totalPages={data?.totalPages || 1}
          onPageChange={setPage} onSearch={(q) => { setSearch(q); setPage(1); }}
          onSort={(col) => { if (sortBy === col) setSortOrder(sortOrder === "asc" ? "desc" : "asc"); else { setSortBy(col); setSortOrder("asc"); } }}
          sortBy={sortBy} sortOrder={sortOrder} loading={isLoading}
        />
      </div>
    </div>
  );
}

export function Channels() { return <GenericTablePage table="channels" title="Channels" subtitle="Manage marketplace channels" />; }
export function Products() { return <GenericTablePage table="products" title="Products" subtitle="Manage products and listings" />; }
export function Orders() { return <GenericTablePage table="orders" title="Orders" subtitle="Manage marketplace orders" />; }
export function Bids() { return <GenericTablePage table="bids" title="Bids" subtitle="Manage bidding activity" />; }
export function Chats() { return <GenericTablePage table="messages" title="Chats & Messages" subtitle="View and moderate messages" />; }
export function Reviews() { return <GenericTablePage table="reviews" title="Reviews" subtitle="Manage product reviews" />; }
export function Notifications() { return <GenericTablePage table="notifications" title="Notifications" subtitle="Manage user notifications" />; }
