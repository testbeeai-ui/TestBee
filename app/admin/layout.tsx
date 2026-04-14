"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Shield, Users, FileClock } from "lucide-react";
import { AdminRoute } from "@/components/AdminRoute";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/dashboard", label: "Overview", icon: BarChart3 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/token-logs", label: "Token Logs", icon: FileClock },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AdminRoute>
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex w-full max-w-[1600px] gap-6 px-4 py-6 md:px-6">
          <aside className="hidden md:block w-64 shrink-0">
            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <p className="font-semibold">Admin Console</p>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </AdminRoute>
  );
}
