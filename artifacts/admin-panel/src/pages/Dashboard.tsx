import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];
const STAT_ICONS: Record<string, { icon: string; color: string }> = {
  users: { icon: "👥", color: "purple" }, sellers: { icon: "🏪", color: "green" }, buyers: { icon: "🛍️", color: "blue" },
  channels: { icon: "📺", color: "orange" }, products: { icon: "📦", color: "pink" }, orders: { icon: "🛒", color: "green" },
  bids: { icon: "🔨", color: "blue" }, activeBids: { icon: "⚡", color: "orange" }, reviews: { icon: "⭐", color: "purple" },
  revenue: { icon: "💰", color: "green" }, messages: { icon: "💬", color: "blue" }, notifications: { icon: "🔔", color: "red" },
  groups: { icon: "👨‍👩‍👧‍👦", color: "purple" }, reports: { icon: "🚩", color: "red" }, admins: { icon: "🛡️", color: "purple" },
  bannedUsers: { icon: "🚫", color: "red" },
};

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => api.get("/dashboard/stats") });
  const { data: charts } = useQuery({ queryKey: ["dashboard-charts"], queryFn: () => api.get("/dashboard/charts") });
  const { data: activity } = useQuery({ queryKey: ["dashboard-activity"], queryFn: () => api.get("/dashboard/activity") });

  if (isLoading) return <div className="loading"><div className="spinner" /></div>;

  const statEntries = stats ? Object.entries(stats).filter(([k]) => STAT_ICONS[k]) : [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">O2O Marketplace Overview</p>
      </div>

      <div className="stat-grid">
        {statEntries.map(([key, value]) => {
          const info = STAT_ICONS[key] || { icon: "📊", color: "purple" };
          return (
            <div className="card stat-card" key={key}>
              <div className={`stat-icon ${info.color}`}>{info.icon}</div>
              <div>
                <div className="stat-value">{key === "revenue" ? `₹${(value as number).toLocaleString()}` : (value as number).toLocaleString()}</div>
                <div className="stat-label">{key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="charts-grid">
        {charts?.usersByRole && charts.usersByRole.length > 0 && (
          <div className="card chart-card">
            <h3 style={{ marginBottom: 16 }}>Users by Role</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart><Pie data={charts.usersByRole} dataKey="count" nameKey="role" cx="50%" cy="50%" outerRadius={90} label={({ role, count }: any) => `${role}: ${count}`}>
                {charts.usersByRole.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {charts?.ordersByStatus && charts.ordersByStatus.length > 0 && (
          <div className="card chart-card">
            <h3 style={{ marginBottom: 16 }}>Orders by Status</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={charts.ordersByStatus}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="status" stroke="var(--text-muted)" /><YAxis stroke="var(--text-muted)" /><Tooltip /><Bar dataKey="count" fill="#6366f1" radius={[4,4,0,0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {charts?.bidsByStatus && charts.bidsByStatus.length > 0 && (
          <div className="card chart-card">
            <h3 style={{ marginBottom: 16 }}>Bids by Status</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={charts.bidsByStatus}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="status" stroke="var(--text-muted)" /><YAxis stroke="var(--text-muted)" /><Tooltip /><Bar dataKey="count" fill="#10b981" radius={[4,4,0,0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {activity?.recentUsers && activity.recentUsers.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 16 }}>Recent Users</h3>
        <div className="table-responsive">
          <table><thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
            <tbody>{activity.recentUsers.map((u: any) => (
              <tr key={u.id}><td>{u.username}</td><td>{u.email}</td><td><span className={`badge badge-${u.role === "admin" ? "purple" : u.role === "seller" ? "green" : "blue"}`}>{u.role}</span></td><td>{new Date(u.createdAt || u.created_at).toLocaleDateString()}</td></tr>
            ))}</tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}
