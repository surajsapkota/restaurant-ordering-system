"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authstore";
import "./admin.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);

  function logout() {
    clearAuth();
    router.push("/login");
  }

  const navItems = [
    { label: "Overview", path: "/admin" },
    { label: "Sales & Reports", path: "/admin/sales" },
    { label: "Menu", path: "/admin/menu" },
    { label: "Employees", path: "/admin/employees" },
    { label: "Shifts", path: "/admin/shifts" },
    { label: "Settings", path: "/admin/settings" },
  ];

  return (
    <div className="adminShell">
      <aside className="adminSidebar">
        <div className="adminLogo">Bombay to Mumbai</div>
        <nav className="adminNav">
          {navItems.map((item) => (
            <button
              key={item.path}
              className={`adminNavItem ${pathname === item.path ? "active" : ""}`}
              onClick={() => router.push(item.path)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="adminSidebarBottom">
          <div className="adminWho">{user?.name ?? "Admin"}</div>
          <button className="adminLogoutBtn" onClick={logout} type="button">
            Logout
          </button>
        </div>
      </aside>
      <main className="adminMain">{children}</main>
    </div>
  );
}