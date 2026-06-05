"use client";

import { useEffect, useState } from "react";
import { safeGetSession } from "@/lib/auth/safeSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Ticket,
  Plus,
  Search,
  Filter,
  Copy,
  Info,
  Trash2,
} from "lucide-react";

type SubscriptionCoupon = {
  id: string;
  code: string;
  plan_tier: "starter" | "pro";
  duration_months: number;
  restricted_to_user_ids: string[] | null;
  status: "active" | "redeemed" | "expired";
  created_at: string;
  redeemed_at: string | null;
  redeemed_by_user_id: string | null;
};

type Student = {
  id: string;
  name: string | null;
  email: string | null;
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter Plan",
  pro: "Pro Plan",
};

export function StudentCouponsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"ready" | "unauthorized" | "forbidden" | "error">("ready");
  const [errorMsg, setErrorMsg] = useState("");

  const [coupons, setCoupons] = useState<SubscriptionCoupon[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "history" | "generate">("active");

  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | "starter" | "pro">("all");

  const [planTier, setPlanTier] = useState<"starter" | "pro">("starter");
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [generateCount, setGenerateCount] = useState<number>(1);
  const [restrictedIds, setRestrictedIds] = useState<string[]>([]);
  const [generatorLoading, setGeneratorLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  async function loadData() {
    setLoading(true);
    setErrorMsg("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) {
        setStatus("unauthorized");
        return;
      }

      const headers = { Authorization: `Bearer ${session.access_token}` };

      const [couponsRes, studentsRes] = await Promise.all([
        fetch("/api/admin/coupons/student", { headers }),
        fetch("/api/admin/students?mode=directory", { headers }),
      ]);

      const couponsBody = await couponsRes.json();
      const studentsBody = await studentsRes.json();

      if (couponsRes.status === 401) {
        setStatus("unauthorized");
        return;
      }
      if (couponsRes.status === 403) {
        setStatus("forbidden");
        return;
      }
      if (!couponsRes.ok) throw new Error(couponsBody.error || "Failed to load coupons");
      if (!studentsRes.ok) throw new Error(studentsBody.error || "Failed to load students");

      setCoupons(couponsBody.coupons ?? []);
      setStudents(studentsBody.students ?? []);
      setStatus("ready");
    } catch (e) {
      console.error(e);
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (durationMonths <= 0) {
      toast({ title: "Please enter a valid duration", variant: "destructive" });
      return;
    }

    setGeneratorLoading(true);
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing session");

      const res = await fetch("/api/admin/coupons/student", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          planTier,
          durationMonths,
          count: generateCount,
          restrictedToUserIds: restrictedIds,
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to generate coupons");

      toast({
        title: "Coupons Generated!",
        description: `Created ${body.coupons?.length ?? generateCount} ${PLAN_LABELS[planTier]} coupon(s) for ${durationMonths} month(s).`,
      });

      setRestrictedIds([]);
      setGenerateCount(1);
      void loadData();
      setActiveTab("active");
    } catch (err) {
      toast({
        title: "Generation Failed",
        description: err instanceof Error ? err.message : "Could not generate coupons",
        variant: "destructive",
      });
    } finally {
      setGeneratorLoading(false);
    }
  };

  const handleCopy = (code: string) => {
    void navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: `Coupon code "${code}" copied to clipboard.` });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this coupon? This action cannot be undone."))
      return;
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing session");

      const res = await fetch(`/api/admin/coupons/student?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Delete failed");

      toast({ title: "Deleted!", description: "Coupon deleted successfully." });
      void loadData();
    } catch (err) {
      toast({
        title: "Delete Failed",
        description: err instanceof Error ? err.message : "Could not delete coupon",
        variant: "destructive",
      });
    }
  };

  const studentMap = new Map(
    students.map((s) => [s.id, s.email || s.name || "Unknown Student"])
  );

  const activeCoupons = coupons.filter((c) => c.status === "active");
  const redeemedCoupons = coupons.filter((c) => c.status !== "active");

  const filterCoupons = (list: SubscriptionCoupon[]) => {
    return list.filter((c) => {
      const matchesSearch = c.code.toLowerCase().includes(search.trim().toLowerCase());
      const matchesPlan = planFilter === "all" || c.plan_tier === planFilter;
      return matchesSearch && matchesPlan;
    });
  };

  const displayActive = filterCoupons(activeCoupons);
  const displayHistory = filterCoupons(redeemedCoupons);

  const filteredStudents = students.filter((s) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.trim().toLowerCase();
    return (
      (s.email ?? "").toLowerCase().includes(q) ||
      (s.name ?? "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-sm text-slate-400">
        Loading student coupons...
      </div>
    );
  }

  if (status === "unauthorized") {
    return <div className="p-4 text-rose-400">Unauthorized (please sign in first)</div>;
  }
  if (status === "forbidden") {
    return <div className="p-4 text-rose-400">Forbidden (admin role required)</div>;
  }
  if (status === "error") {
    return <div className="p-4 text-rose-400">Failed to load: {errorMsg}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            Student Coupon Codes
          </h2>
          <p className="text-xs text-muted-foreground">
            Generate plan coupons (Starter/Pro + months). Students claim codes from Subscription → Coupon code.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-3 md:mt-0">
          <Button
            variant={activeTab === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("active")}
            className="rounded-xl"
          >
            Active ({activeCoupons.length})
          </Button>
          <Button
            variant={activeTab === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("history")}
            className="rounded-xl"
          >
            Redeemed ({redeemedCoupons.length})
          </Button>
          <Button
            variant={activeTab === "generate" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("generate")}
            className="rounded-xl border-dashed border-primary/40"
          >
            <Plus className="mr-1 h-4 w-4" />
            Generate
          </Button>
        </div>
      </div>

      {activeTab !== "generate" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card border rounded-xl p-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search coupon code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background/50 rounded-xl"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              className="border bg-background rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none"
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value as "all" | "starter" | "pro")}
            >
              <option value="all">All Plans</option>
              <option value="starter">Starter Only</option>
              <option value="pro">Pro Only</option>
            </select>
          </div>
        </div>
      )}

      {activeTab === "active" && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 border-b text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="p-3">Coupon Code</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3 text-right">Duration</th>
                  <th className="p-3">Restrictions</th>
                  <th className="p-3">Generated</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayActive.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No active coupons found.
                    </td>
                  </tr>
                ) : (
                  displayActive.map((coupon) => (
                    <tr key={coupon.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 font-mono font-bold tracking-wide text-foreground">
                        {coupon.code}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            coupon.plan_tier === "pro"
                              ? "bg-violet-500/10 border border-violet-400/20 text-violet-300"
                              : "bg-emerald-500/10 border border-emerald-400/20 text-emerald-300"
                          }`}
                        >
                          {PLAN_LABELS[coupon.plan_tier] ?? coupon.plan_tier}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-foreground">
                        {coupon.duration_months} mo
                      </td>
                      <td className="p-3 max-w-[250px] truncate">
                        {coupon.restricted_to_user_ids &&
                        coupon.restricted_to_user_ids.length > 0 ? (
                          <span
                            className="text-xs text-amber-300 bg-amber-500/5 border border-amber-400/10 px-1.5 py-0.5 rounded block truncate"
                            title={coupon.restricted_to_user_ids
                              .map((id) => studentMap.get(id) || id)
                              .join(", ")}
                          >
                            {coupon.restricted_to_user_ids
                              .map((id) => studentMap.get(id) || id)
                              .join(", ")}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">None (Public)</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(coupon.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 text-center flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(coupon.code)}
                          className="h-8 rounded-lg"
                          title="Copy Code"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(coupon.id)}
                          className="h-8 rounded-lg text-rose-400 hover:text-rose-500 hover:bg-rose-500/10"
                          title="Delete Coupon"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl bg-blue-500/10 border border-blue-400/20 p-3 text-xs text-blue-300">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Redeemed coupons are kept for 28 days, then hidden from this list. Students see only
              the code — plan and duration are applied automatically on claim.
            </p>
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/40 border-b text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="p-3">Coupon Code</th>
                    <th className="p-3">Plan</th>
                    <th className="p-3 text-right">Duration</th>
                    <th className="p-3">Redeemed By</th>
                    <th className="p-3">Redeemed Date</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No redeemed coupons found.
                      </td>
                    </tr>
                  ) : (
                    displayHistory.map((coupon) => (
                      <tr key={coupon.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-3 font-mono text-slate-400 line-through">
                          {coupon.code}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {PLAN_LABELS[coupon.plan_tier] ?? coupon.plan_tier}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-500">
                          {coupon.duration_months} mo
                        </td>
                        <td className="p-3 text-xs">
                          {studentMap.get(coupon.redeemed_by_user_id ?? "") || "—"}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {coupon.redeemed_at
                            ? new Date(coupon.redeemed_at).toLocaleString()
                            : "N/A"}
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(coupon.id)}
                            className="h-8 rounded-lg text-rose-400 hover:text-rose-500 hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "generate" && (
        <form
          onSubmit={handleGenerate}
          className="max-w-2xl mx-auto rounded-xl border bg-card overflow-hidden"
        >
          <div className="border-b bg-muted/40 px-4 py-3">
            <h2 className="text-lg font-semibold flex items-center gap-1.5">
              <Plus className="h-5 w-5 text-primary" />
              Generate Student Plan Coupons
            </h2>
            <p className="text-xs text-muted-foreground">
              Students enter the code only — plan and months are applied on claim.
            </p>
          </div>
          <div className="p-4 md:p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Plan</label>
              <div className="grid grid-cols-2 gap-2">
                {(["starter", "pro"] as const).map((plan) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => setPlanTier(plan)}
                    className={`border rounded-xl p-3 font-semibold transition text-center ${
                      planTier === plan
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                        : "bg-muted/20 border-white/5 text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    {PLAN_LABELS[plan]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Duration (months)</label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 3, 6, 12].map((mo) => (
                  <button
                    key={mo}
                    type="button"
                    onClick={() => setDurationMonths(mo)}
                    className={`border rounded-xl p-3 font-mono font-bold transition text-center ${
                      durationMonths === mo
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                        : "bg-muted/20 border-white/5 text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    {mo} mo
                  </button>
                ))}
              </div>
              <Input
                type="number"
                value={durationMonths}
                onChange={(e) =>
                  setDurationMonths(Math.max(1, Math.min(24, Number(e.target.value))))
                }
                min={1}
                max={24}
                className="font-mono bg-background mt-2"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center justify-between">
                <span>Quantity</span>
                {restrictedIds.length > 0 && (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                    Locked to student count
                  </span>
                )}
              </label>
              <Input
                type="number"
                value={generateCount}
                onChange={(e) => {
                  if (restrictedIds.length === 0) {
                    setGenerateCount(Math.max(1, Math.min(100, Number(e.target.value))));
                  }
                }}
                disabled={restrictedIds.length > 0}
                min={1}
                max={100}
                className="bg-background font-mono"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center justify-between">
                <span>Restrict to Students (optional)</span>
                {restrictedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setRestrictedIds([]);
                      setGenerateCount(1);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Clear selection
                  </button>
                )}
              </label>
              <p className="text-xs text-muted-foreground">
                Leave empty for public codes. Select students to issue one code per student (by
                email).
              </p>
              <Input
                placeholder="Search students by email or name..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="bg-background text-sm"
              />
              <div className="border border-white/10 rounded-xl max-h-48 overflow-y-auto bg-background/50 divide-y divide-white/5 p-1">
                {filteredStudents.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">
                    No students found.
                  </p>
                ) : (
                  filteredStudents.map((student) => {
                    const checked = restrictedIds.includes(student.id);
                    return (
                      <label
                        key={student.id}
                        className="flex items-center gap-3 p-2 text-xs hover:bg-muted/10 cursor-pointer rounded-lg transition"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              const nextIds = restrictedIds.filter((id) => id !== student.id);
                              setRestrictedIds(nextIds);
                              setGenerateCount(nextIds.length > 0 ? nextIds.length : 1);
                            } else {
                              const nextIds = [...restrictedIds, student.id];
                              setRestrictedIds(nextIds);
                              setGenerateCount(nextIds.length);
                            }
                          }}
                          className="rounded border-white/10"
                        />
                        <div>
                          <p className="font-semibold text-foreground">
                            {student.email || student.name || "Unnamed Student"}
                          </p>
                          {student.email && student.name ? (
                            <p className="text-[10px] text-muted-foreground">{student.name}</p>
                          ) : null}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <Button
              type="submit"
              disabled={generatorLoading}
              className="w-full rounded-xl bg-primary text-primary-foreground font-semibold py-6"
            >
              {generatorLoading
                ? "Generating..."
                : `Generate ${generateCount} Coupon(s) — ${PLAN_LABELS[planTier]}, ${durationMonths} mo`}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
