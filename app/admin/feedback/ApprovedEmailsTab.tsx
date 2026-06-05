"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, Plus, Trash2, Search, RefreshCw, X } from "lucide-react";
import { safeGetSession } from "@/lib/auth/safeSession";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ApprovedEmailRow = {
  id: string;
  email: string;
  role: "student" | "teacher";
  first_name: string;
  last_name: string;
  waitlist_submission_id: string | null;
  created_at: string;
};

export function ApprovedEmailsTab() {
  const [rows, setRows] = useState<ApprovedEmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  
  // Manual Modal/Form state
  const [showForm, setShowForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"student" | "teacher">("student");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Unauthorized");

      const sp = new URLSearchParams();
      if (search.trim()) sp.set("search", search.trim());

      const res = await fetch(`/api/admin/approved-emails?${sp.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load approved emails");
      setRows(data.rows || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, load]);

  const handleManualWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Unauthorized");

      const res = await fetch("/api/admin/approved-emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newEmail.trim(),
          role: newRole,
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          sendInvite,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to whitelist email");

      // Reset form & reload
      setNewEmail("");
      setNewFirstName("");
      setNewLastName("");
      setSendInvite(true);
      setShowForm(false);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error submitting");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to revoke signup approval for ${email}?`)) return;

    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Unauthorized");

      const res = await fetch(`/api/admin/approved-emails/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke approval");

      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error revoking");
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Approved Signup Whitelist</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage pre-approved emails that are whitelisted to bypass the waitlist gate.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Whitelist Email
            </Button>
          </div>
        </div>
      </div>

      {/* Toolbar / Search */}
      <div className="flex items-center gap-3 bg-card p-3 rounded-xl border">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search approved emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-muted/20 border-border"
          />
        </div>
        {loading && <span className="text-xs text-muted-foreground animate-pulse">Filtering Whitelist...</span>}
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Whitelisted emails list */}
      <Card>
        <CardHeader className="py-4 border-b">
          <CardTitle className="text-base">Approved Accounts ({rows.length})</CardTitle>
          <CardDescription>
            These emails can sign up immediately. Accounts that are already fully onboarding-completed do not require entries in this list.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="px-5 py-3">Email Address</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Waitlist Ref</th>
                  <th className="px-5 py-3">Date Approved</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-foreground">
                      {row.email}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase",
                        row.role === "student" && "bg-emerald-500/10 text-emerald-400",
                        row.role === "teacher" && "bg-sky-500/10 text-sky-400"
                      )}>
                        {row.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-muted-foreground">
                      {row.first_name} {row.last_name || ""}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap font-mono text-xs">
                      {row.waitlist_submission_id ? (
                        <span className="text-primary font-semibold">Yes (Linked)</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 p-2 h-auto"
                        onClick={() => handleRevoke(row.id, row.email)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                      No approved emails found in this category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Manual Whitelist Overlay Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-card border border-border shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowForm(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-white hover:bg-white/5 rounded-full p-1.5 transition"
            >
              <X className="h-4 w-4" />
            </button>
            <CardHeader>
              <CardTitle>Whitelist New Email</CardTitle>
              <CardDescription>
                Manually authorize a new email address to sign up and skip the waitlist check.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleManualWhitelist} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Email Address</label>
                  <Input
                    type="email"
                    required
                    placeholder="student@gmail.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="bg-muted/10 border-border"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">First Name</label>
                    <Input
                      type="text"
                      placeholder="Rahul"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      className="bg-muted/10 border-border"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Last Name</label>
                    <Input
                      type="text"
                      placeholder="Verma"
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      className="bg-muted/10 border-border"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Target Role</label>
                  <Select value={newRole} onValueChange={(val) => setNewRole(val as "student" | "teacher")}>
                    <SelectTrigger className="w-full bg-muted/10 border-border">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student Account</SelectItem>
                      <SelectItem value="teacher">Teacher / Tutor Account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="sendInvite"
                    checked={sendInvite}
                    onChange={(e) => setSendInvite(e.target.checked)}
                    className="rounded border-border bg-muted/10 text-primary focus:ring-primary accent-[#1D9E75] h-4 w-4 cursor-pointer"
                  />
                  <label htmlFor="sendInvite" className="text-xs font-medium text-foreground cursor-pointer select-none">
                    Send invitation email immediately upon approval
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t mt-4">
                  <Button variant="ghost" type="button" onClick={() => setShowForm(false)} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} className="bg-primary hover:bg-primary/90">
                    {submitting ? "Whitelisting..." : "Approve & Whitelist"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
