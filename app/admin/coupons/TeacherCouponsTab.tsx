"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

type Coupon = {
  id: string;
  code: string;
  rdm_amount: number;
  restricted_to_teacher_ids: string[] | null;
  is_purchased: boolean;
  bought_by_teacher_id: string | null;
  status: "active" | "redeemed" | "expired";
  created_at: string;
  redeemed_at: string | null;
  redeemed_by_teacher_id: string | null;
  order_id: string | null;
  payment_method: string | null;
};

type Teacher = {
  id: string;
  name: string | null;
  email: string | null;
};

export function TeacherCouponsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"ready" | "unauthorized" | "forbidden" | "error">("ready");
  const [errorMsg, setErrorMsg] = useState("");

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "history" | "generate">("active");

  // Filter & Search states
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "promo" | "purchased">("all");

  // Generator form states
  const [rdmAmount, setRdmAmount] = useState<number>(500);
  const [isCustomAmount, setIsCustomAmount] = useState(false);
  const [generateCount, setGenerateCount] = useState<number>(1);
  const [restrictedIds, setRestrictedIds] = useState<string[]>([]);
  const [generatorLoading, setGeneratorLoading] = useState(false);

  // Load coupons and teachers
  async function loadData() {
    setLoading(true);
    setErrorMsg("");
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) {
        setStatus("unauthorized");
        return;
      }

      // Check role
      const { data: roleRow, error: roleErr } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleErr) throw roleErr;
      if (!roleRow) {
        setStatus("forbidden");
        return;
      }

      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");

      // Load coupons
      const couponsRes = await fetch("/api/admin/coupons", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const couponsBody = await couponsRes.json();
      if (!couponsRes.ok) throw new Error(couponsBody.error || "Failed to load coupons");

      // Load teachers
      const teachersRes = await fetch("/api/admin/teachers?mode=directory", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const teachersBody = await teachersRes.json();
      if (!teachersRes.ok) throw new Error(teachersBody.error || "Failed to load teachers");

      setCoupons(couponsBody.coupons ?? []);
      setTeachers(teachersBody.teachers ?? []);
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
    if (!rdmAmount || rdmAmount <= 0) {
      toast({ title: "Please enter a valid RDM amount", variant: "destructive" });
      return;
    }

    setGeneratorLoading(true);
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing session");

      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          rdmAmount,
          count: generateCount,
          restrictedToTeacherIds: restrictedIds,
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to generate coupons");

      toast({
        title: "Coupons Generated!",
        description: `Successfully generated ${generateCount} coupon(s) for ${rdmAmount} RDM.`,
      });

      // Clear generation state
      setRestrictedIds([]);
      setGenerateCount(1);
      
      // Reload coupons
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
    if (!confirm("Are you sure you want to delete this coupon? This action cannot be undone.")) return;
    try {
      const { error } = await (supabase as any).from("coupons").delete().eq("id", id);
      if (error) throw error;
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

  const teacherMap = new Map(teachers.map((t) => [t.id, t.email || t.name || "Unknown Teacher"]));

  const activeCoupons = coupons.filter((c) => c.status === "active");
  const redeemedCoupons = coupons.filter((c) => c.status !== "active");

  const filterCoupons = (list: Coupon[]) => {
    return list.filter((c) => {
      // search by code or orderId
      const matchesSearch =
        c.code.toLowerCase().includes(search.trim().toLowerCase()) ||
        (c.order_id && c.order_id.toLowerCase().includes(search.trim().toLowerCase()));

      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "promo" && !c.is_purchased) ||
        (typeFilter === "purchased" && c.is_purchased);

      return matchesSearch && matchesType;
    });
  };

  const displayActive = filterCoupons(activeCoupons);
  const displayHistory = filterCoupons(redeemedCoupons);

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-sm text-slate-400">
        Loading teacher coupons...
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
      {/* Header section with tab toggle */}
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            Teacher Coupon Codes
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage promotional coupons and track teacher-purchased RDM codes.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-3 md:mt-0">
          <Button
            variant={activeTab === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("active")}
            className="rounded-xl"
          >
            Active Coupons ({activeCoupons.length})
          </Button>
          <Button
            variant={activeTab === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("history")}
            className="rounded-xl"
          >
            Redeemed &amp; Expired ({redeemedCoupons.length})
          </Button>
          <Button
            variant={activeTab === "generate" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("generate")}
            className="rounded-xl border-dashed border-primary/40"
          >
            <Plus className="mr-1 h-4 w-4" />
            Generate Coupons
          </Button>
        </div>
      </div>

      {/* SEARCH AND FILTERS (for tabs with lists) */}
      {activeTab !== "generate" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card border rounded-xl p-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search coupon code or Order ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background/50 rounded-xl"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              className="border bg-background rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="all">All Types</option>
              <option value="promo">Promotional Only</option>
              <option value="purchased">Paid via Razorpay</option>
            </select>
          </div>
        </div>
      )}

      {/* ACTIVE TAB */}
      {activeTab === "active" && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 border-b text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="p-3">Coupon Code</th>
                  <th className="p-3 text-right">RDM Value</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Restrictions</th>
                  <th className="p-3">Generated Date</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayActive.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No active coupons found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  displayActive.map((coupon) => (
                    <tr key={coupon.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 font-mono font-bold tracking-wide text-foreground">
                        {coupon.code}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-emerald-400">
                        {coupon.rdm_amount.toLocaleString()} RDM
                      </td>
                      <td className="p-3">
                        {coupon.is_purchased ? (
                          <span className="inline-flex items-center rounded-full bg-blue-500/10 border border-blue-400/20 px-2 py-0.5 text-xs font-semibold text-blue-300">
                            Paid (Razorpay)
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                            Promotional
                          </span>
                        )}
                      </td>
                      <td className="p-3 max-w-[250px] truncate">
                        {coupon.is_purchased ? (
                          <span className="text-xs text-muted-foreground">
                            Buyer: {teacherMap.get(coupon.bought_by_teacher_id ?? "") || "Unknown"}
                          </span>
                        ) : coupon.restricted_to_teacher_ids &&
                          coupon.restricted_to_teacher_ids.length > 0 ? (
                          <span 
                            className="text-xs text-amber-300 bg-amber-500/5 border border-amber-400/10 px-1.5 py-0.5 rounded block truncate"
                            title={coupon.restricted_to_teacher_ids.map(id => teacherMap.get(id) || id).join(", ")}
                          >
                            {coupon.restricted_to_teacher_ids.map(id => teacherMap.get(id) || id).join(", ")}
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

      {/* REDEEMED / EXPIRED TAB */}
      {activeTab === "history" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl bg-blue-500/10 border border-blue-400/20 p-3 text-xs text-blue-300">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Accounting policy: Coupons purchased by teachers (Paid) are tracked permanently for financial records. Promotional coupons are cleaned up from this screen 28 days after redemption.
            </p>
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/40 border-b text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="p-3">Coupon Code</th>
                    <th className="p-3 text-right">RDM Value</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Redeemed By</th>
                    <th className="p-3">Redeemed Date</th>
                    <th className="p-3">Payment Info</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No redeemed or expired coupons found.
                      </td>
                    </tr>
                  ) : (
                    displayHistory.map((coupon) => (
                      <tr key={coupon.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-3 font-mono text-slate-400 line-through">
                          {coupon.code}
                        </td>
                        <td className="p-3 text-right font-mono font-medium text-slate-500">
                          {coupon.rdm_amount.toLocaleString()} RDM
                        </td>
                        <td className="p-3">
                          {coupon.is_purchased ? (
                            <span className="inline-flex items-center rounded-full bg-blue-500/5 border border-blue-500/10 px-2 py-0.5 text-xs font-semibold text-slate-400">
                              Paid (Razorpay)
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-500/5 border border-slate-500/10 px-2 py-0.5 text-xs font-semibold text-slate-400">
                              Promotional
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="text-xs font-medium text-foreground">
                            {teacherMap.get(coupon.redeemed_by_teacher_id ?? "") || "System / Expired"}
                          </div>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {coupon.redeemed_at ? new Date(coupon.redeemed_at).toLocaleString() : "N/A"}
                        </td>
                        <td className="p-3 text-xs font-mono text-muted-foreground">
                          {coupon.is_purchased ? (
                            <div>
                              <p className="font-semibold text-foreground/80">{coupon.order_id}</p>
                              <p className="text-[10px] text-muted-foreground uppercase">{coupon.payment_method}</p>
                            </div>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
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
        </div>
      )}

      {/* GENERATE TAB */}
      {activeTab === "generate" && (
        <form onSubmit={handleGenerate} className="max-w-2xl mx-auto rounded-xl border bg-card overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-3">
            <h2 className="text-lg font-semibold flex items-center gap-1.5">
              <Plus className="h-5 w-5 text-primary" />
              Generate Promotional Coupons
            </h2>
            <p className="text-xs text-muted-foreground">
              Create 8-character, year-prefixed codes for specific teacher wallets.
            </p>
          </div>
          <div className="p-4 md:p-6 space-y-6">
            {/* RDM AMOUNT SELECTOR */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select RDM Amount</label>
              <div className="grid grid-cols-4 gap-2">
                {[100, 500, 1000, 2200].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setRdmAmount(amt);
                      setIsCustomAmount(false);
                    }}
                    className={`border rounded-xl p-3 font-mono font-bold transition text-center ${
                      rdmAmount === amt && !isCustomAmount
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                        : "bg-muted/20 border-white/5 text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    {amt} RDM
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="customAmount"
                  checked={isCustomAmount}
                  onChange={(e) => {
                    setIsCustomAmount(e.target.checked);
                    if (e.target.checked) setRdmAmount(0);
                    else setRdmAmount(500);
                  }}
                  className="rounded border-white/10"
                />
                <label htmlFor="customAmount" className="text-xs text-muted-foreground select-none">
                  Use custom RDM amount
                </label>
              </div>

              {isCustomAmount && (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    value={rdmAmount || ""}
                    onChange={(e) => setRdmAmount(Number(e.target.value))}
                    placeholder="Enter custom RDM amount..."
                    className="font-mono bg-background"
                    min="1"
                    required
                  />
                  <span className="text-sm font-semibold text-amber-400 shrink-0">RDM</span>
                </div>
              )}
            </div>

            {/* COUNT */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center justify-between">
                <span>Quantity to Generate</span>
                {restrictedIds.length > 0 && (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                    Locked to teacher count
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
                placeholder="Number of coupons (max 100)..."
                className="bg-background font-mono"
                min="1"
                max="100"
                required
              />
            </div>

            {/* TEACHER RESTRICTION */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center justify-between">
                <span>Restrict to Teachers (Optional)</span>
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
                If no teachers are selected, the coupon will be public (any teacher can redeem it once). If selected, only the chosen teacher(s) can redeem it.
              </p>
              
              <div className="border border-white/10 rounded-xl max-h-48 overflow-y-auto bg-background/50 divide-y divide-white/5 p-1">
                {teachers.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">No teachers registered.</p>
                ) : (
                  teachers.map((teacher) => {
                    const checked = restrictedIds.includes(teacher.id);
                    return (
                      <label
                        key={teacher.id}
                        className="flex items-center gap-3 p-2 text-xs hover:bg-muted/10 cursor-pointer rounded-lg transition"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              const nextIds = restrictedIds.filter((id) => id !== teacher.id);
                              setRestrictedIds(nextIds);
                              setGenerateCount(nextIds.length > 0 ? nextIds.length : 1);
                            } else {
                              const nextIds = [...restrictedIds, teacher.id];
                              setRestrictedIds(nextIds);
                              setGenerateCount(nextIds.length);
                            }
                          }}
                          className="rounded border-white/10"
                        />
                        <div>
                          <p className="font-semibold text-foreground">{teacher.email || teacher.name || "Unnamed Teacher"}</p>
                          <p className="text-[10px] text-muted-foreground">{teacher.id}</p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* SUBMIT */}
            <Button
              type="submit"
              disabled={generatorLoading}
              className="w-full rounded-xl bg-primary text-primary-foreground font-semibold py-6"
            >
              {generatorLoading ? "Generating..." : `Generate ${generateCount} Coupon(s)`}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
