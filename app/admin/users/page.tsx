"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AdminUser = {
  id: string;
  email: string | null;
  role: string | null;
  name: string | null;
  classLevel: number | null;
  stream: string | null;
  subjectCombo: string | null;
  rdm: number;
  streakMinutes: number;
  createdAt: string | null;
  lastSignInAt: string | null;
  bannedUntil: string | null;
  suspendedUntil: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  deleteScheduledFor: string | null;
  isBanned: boolean;
  status: "active" | "suspended" | "banned" | "soft_deleted";
  canAct: boolean;
  actionLockedReason: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function fmtDateShort(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [actingUserId, setActingUserId] = useState<string | null>(null);
  const [suspendDaysByUser, setSuspendDaysByUser] = useState<Record<string, number>>({});

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Missing session token");
        return;
      }

      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const body = (await res.json()) as { users?: AdminUser[]; error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to fetch users");
      setUsers(Array.isArray(body.users) ? body.users : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const stats = useMemo(() => {
    const students = users.filter((u) => u.role === "student").length;
    const teachers = users.filter((u) => u.role === "teacher").length;
    const admins = users.filter((u) => u.role === "admin").length;
    const banned = users.filter((u) => u.isBanned).length;
    return { students, teachers, admins, banned };
  }, [users]);

  const applyAction = useCallback(
    async (
      user: AdminUser,
      action: "ban" | "unban" | "suspend" | "unsuspend" | "soft_delete" | "restore"
    ) => {
      setActingUserId(user.id);
      setError("");
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Missing session token");

        const suspendDays = suspendDaysByUser[user.id] ?? 7;
        const isHighRisk = action === "soft_delete";
        if (isHighRisk) {
          const ok = window.confirm("Soft delete this account? This can be restored later.");
          if (!ok) return;
        }

        const res = await fetch("/api/admin/users/action", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            userId: user.id,
            action,
            suspendDays,
          }),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(body.error || "Failed to apply action");
        await loadUsers();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setActingUserId(null);
      }
    },
    [loadUsers, suspendDaysByUser]
  );

  const statusBadge = (status: AdminUser["status"]) => {
    if (status === "banned") return <Badge variant="destructive">Banned</Badge>;
    if (status === "suspended") return <Badge className="bg-amber-600 hover:bg-amber-600">Suspended</Badge>;
    if (status === "soft_deleted") return <Badge className="bg-slate-600 hover:bg-slate-600">Soft Deleted</Badge>;
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-5">
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Full governance: suspend, ban, soft delete, restore, and open user analytics.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-background p-3 text-sm">Students: <span className="font-semibold">{stats.students}</span></div>
          <div className="rounded-xl border bg-background p-3 text-sm">Teachers: <span className="font-semibold">{stats.teachers}</span></div>
          <div className="rounded-xl border bg-background p-3 text-sm">Admins: <span className="font-semibold">{stats.admins}</span></div>
          <div className="rounded-xl border bg-background p-3 text-sm">Banned: <span className="font-semibold">{stats.banned}</span></div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name, role..."
            className="sm:max-w-md"
          />
          <Button variant="outline" onClick={loadUsers} disabled={loading}>
            Refresh
          </Button>
        </div>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}

        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Class/Stream</TableHead>
                <TableHead>RDM</TableHead>
                <TableHead>Last Sign In</TableHead>
                <TableHead>User Analytics</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const busy = actingUserId === user.id;
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name || "—"}</TableCell>
                      <TableCell>{user.email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{user.role || "unknown"}</Badge>
                      </TableCell>
                      <TableCell>
                        {statusBadge(user.status)}
                      </TableCell>
                      <TableCell>
                        {user.classLevel ? `Class ${user.classLevel}` : "—"}
                        {user.stream ? ` · ${user.stream}` : ""}
                      </TableCell>
                      <TableCell>{user.rdm.toLocaleString()}</TableCell>
                      <TableCell>{fmtDate(user.lastSignInAt)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/admin/users/${user.id}`}>View analytics</Link>
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        {user.canAct ? (
                          <div className="flex flex-wrap justify-end gap-1">
                            {user.status === "banned" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => applyAction(user, "unban")}
                                disabled={busy}
                                title="Lift ban and allow login again"
                              >
                                {busy ? "Updating..." : "Unban"}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => applyAction(user, "ban")}
                                disabled={busy}
                                title="Block login indefinitely until unbanned by admin"
                              >
                                {busy ? "Updating..." : "Ban"}
                              </Button>
                            )}

                            {user.status === "suspended" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => applyAction(user, "unsuspend")}
                                disabled={busy}
                                title="Lift suspension before it ends"
                              >
                                {busy ? "Updating..." : "Lift suspend"}
                              </Button>
                            ) : (
                              <>
                                <input
                                  type="number"
                                  min={1}
                                  max={365}
                                  value={suspendDaysByUser[user.id] ?? 7}
                                  onChange={(e) =>
                                    setSuspendDaysByUser((prev) => ({
                                      ...prev,
                                      [user.id]: Math.max(1, Math.min(365, Number(e.target.value) || 7)),
                                    }))
                                  }
                                  className="w-16 rounded-md border bg-background px-2 py-1 text-xs"
                                  aria-label="Suspend days"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => applyAction(user, "suspend")}
                                  disabled={busy}
                                  title="Temporarily block login for selected days"
                                >
                                  {busy ? "Updating..." : "Suspend"}
                                </Button>
                              </>
                            )}

                            {user.status === "soft_deleted" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => applyAction(user, "restore")}
                                disabled={busy}
                                title="Undo delete during grace period"
                              >
                                {busy ? "Updating..." : "Undo delete"}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => applyAction(user, "soft_delete")}
                                disabled={busy}
                                title="Deactivate account now and allow undo for 7 days"
                              >
                                {busy ? "Updating..." : "Soft delete"}
                              </Button>
                            )}
                            {user.status === "soft_deleted" ? (
                              <span className="w-full text-[10px] text-muted-foreground text-right">
                                Scheduled delete: {fmtDateShort(user.deleteScheduledFor)}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span
                            className="text-xs text-muted-foreground"
                            title={user.actionLockedReason ?? "Actions unavailable"}
                          >
                            {user.actionLockedReason ?? "Action locked"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
