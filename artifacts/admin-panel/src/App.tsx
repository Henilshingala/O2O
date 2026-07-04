import React from "react";
import { Route, Switch, Router } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ToastProvider } from "./hooks/useToast";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DatabaseBrowser from "./pages/DatabaseBrowser";
import DatabaseTable from "./pages/DatabaseTable";
import Users from "./pages/Users";
import AdminManagement from "./pages/AdminManagement";
import { Channels, Products, Orders, Bids, Chats, Reviews, Notifications } from "./pages/GenericPages";
import FileManager from "./pages/FileManager";
import AuditLogs from "./pages/AuditLogs";
import Settings from "./pages/Settings";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;
  if (!user) return <Login />;

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/database" component={DatabaseBrowser} />
        <Route path="/database/:table" component={DatabaseTable} />
        <Route path="/users" component={Users} />
        <Route path="/admins" component={AdminManagement} />
        <Route path="/channels" component={Channels} />
        <Route path="/products" component={Products} />
        <Route path="/orders" component={Orders} />
        <Route path="/bids" component={Bids} />
        <Route path="/chats" component={Chats} />
        <Route path="/reviews" component={Reviews} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/files" component={FileManager} />
        <Route path="/audit" component={AuditLogs} />
        <Route path="/settings" component={Settings} />
        <Route>
          <div className="empty-state"><h3>Page Not Found</h3><p>The page you're looking for doesn't exist.</p></div>
        </Route>
      </Switch>
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <Router base="/admin">
            <AppRoutes />
          </Router>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
