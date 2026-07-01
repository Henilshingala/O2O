import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../hooks/useAuth";

const NAV_ITEMS = [
  { section: "Overview", items: [
    { path: "/", label: "Dashboard", icon: "📊" },
  ]},
  { section: "Data", items: [
    { path: "/database", label: "Database Browser", icon: "🗄️" },
    { path: "/users", label: "Users", icon: "👥" },
    { path: "/admins", label: "Admin Management", icon: "🛡️" },
  ]},
  { section: "Commerce", items: [
    { path: "/channels", label: "Channels", icon: "📺" },
    { path: "/products", label: "Products", icon: "📦" },
    { path: "/orders", label: "Orders", icon: "🛒" },
    { path: "/bids", label: "Bids", icon: "🔨" },
  ]},
  { section: "Social", items: [
    { path: "/chats", label: "Chats", icon: "💬" },
    { path: "/reviews", label: "Reviews", icon: "⭐" },
    { path: "/notifications", label: "Notifications", icon: "🔔" },
  ]},
  { section: "System", items: [
    { path: "/files", label: "File Manager", icon: "📁" },
    { path: "/audit", label: "Audit Logs", icon: "📋" },
    { path: "/settings", label: "Settings", icon: "⚙️" },
  ]},
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("admin_theme") as "dark" | "light") || "dark");

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("admin_theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const currentLabel = NAV_ITEMS.flatMap(s => s.items).find(i => i.path === location)?.label || "Dashboard";

  return (
    <div className="layout">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">O2O Admin</div>
          <div className="sidebar-subtitle">Marketplace Management</div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((section) => (
            <div key={section.section}>
              <div className="nav-section">{section.section}</div>
              {section.items.map((item) => (
                <Link key={item.path} href={item.path} onClick={() => setSidebarOpen(false)}>
                  <div className={`nav-item ${location === item.path ? "active" : ""}`}>
                    <span className="nav-icon">{item.icon}</span>
                    {item.label}
                  </div>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", marginTop: "auto" }}>
          <div style={{ fontSize: ".8rem", color: "var(--text-muted)" }}>Logged in as</div>
          <div style={{ fontWeight: 600, fontSize: ".9rem" }}>{user?.fullName}</div>
          <div className="admin-badge" style={{ marginTop: 8 }}>{user?.adminRole?.replace("_", " ")}</div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
            <div className="breadcrumbs">
              <span>Admin</span> / <span style={{ color: "var(--text-primary)" }}>{currentLabel}</span>
            </div>
          </div>
          <div className="topbar-right">
            <button className="theme-toggle" onClick={toggleTheme}>{theme === "dark" ? "☀️" : "🌙"}</button>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </div>

      {sidebarOpen && <div className="sidebar-overlay" style={{ display: "block" }} onClick={() => setSidebarOpen(false)} />}
    </div>
  );
}
