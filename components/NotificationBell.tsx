import { useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  personalizeTeacherMotivationMessage,
  studentFirstNameForMotivationGreeting,
} from "@/lib/teacherPortal/motivationMessagePersonalization";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  action_url: string | null;
  created_at: string;
  type: string;
  kind: "assignment_reminder" | "counsel_message";
  rdmDelta?: number;
  actionKind?: string;
  recommendActionId?:
    | "attempt_targeted_mock"
    | "post_doubt"
    | "watch_recorded"
    | "concept_focus_resource"
    | "none";
  recommendActionLabel?: string;
  recommendActionUrl?: string;
}

const NotificationBell = () => {
  const { user, profile } = useAuth();
  const motivationStudentFirstName = useMemo(
    () =>
      studentFirstNameForMotivationGreeting({
        profileFirstName: profile?.first_name,
        profileFullName: profile?.name,
        userMetaFullName:
          typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : undefined,
        userMetaName: typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : undefined,
      }),
    [profile?.first_name, profile?.name, user?.user_metadata?.full_name, user?.user_metadata?.name]
  );
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"unread" | "read">("unread");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Notification | null>(null);
  const seenKey = useMemo(
    () => (user?.id ? `notif.seenMotivation.v1:${user.id}` : null),
    [user?.id]
  );
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    seenIdsRef.current = seenIds;
  }, [seenIds]);

  useEffect(() => {
    if (!seenKey) return;
    try {
      const raw = window.localStorage.getItem(seenKey);
      const ids = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(ids)) {
        setSeenIds(new Set(ids.filter((x): x is string => typeof x === "string")));
      }
    } catch {
      setSeenIds(new Set());
    }
  }, [seenKey]);

  const load = async () => {
    if (!user) return;
    try {
      let persistedSeen = seenIdsRef.current;
      if (seenKey) {
        try {
          const raw = window.localStorage.getItem(seenKey);
          const ids = raw ? (JSON.parse(raw) as unknown) : null;
          if (Array.isArray(ids)) {
            persistedSeen = new Set(ids.filter((x): x is string => typeof x === "string"));
            seenIdsRef.current = persistedSeen;
            setSeenIds(persistedSeen);
          }
        } catch {
          // ignore parse/storage issues
        }
      }

      const { data } = await supabase
        .from("posts")
        .select("id, title, created_at, classroom_id, content_json")
        .eq("type", "motivation")
        .order("created_at", { ascending: false })
        .limit(60);

      const rows =
        (data as unknown as Array<{
          id: string;
          title: string | null;
          created_at: string;
          classroom_id: string;
          content_json: unknown;
        }>) ?? [];

      const mine = rows
        .map((p) => {
          const cj = p.content_json;
          const o =
            cj && typeof cj === "object" && !Array.isArray(cj)
              ? (cj as Record<string, unknown>)
              : null;
          const ids = Array.isArray(o?.targetStudentIds)
            ? (o?.targetStudentIds as unknown[]).filter((x): x is string => typeof x === "string")
            : [];
          if (!user?.id || !ids.includes(user.id)) return null;

          const relatedPostId =
            typeof o?.relatedPostId === "string" && o.relatedPostId.trim()
              ? o.relatedPostId.trim()
              : null;
          const relatedTitle =
            typeof o?.relatedPostTitle === "string" && o.relatedPostTitle.trim()
              ? o.relatedPostTitle.trim()
              : null;
          const message =
            typeof o?.message === "string" && o.message.trim()
              ? o.message.trim()
              : (p.title ?? "New message");

          const isAssignmentReminder = Boolean(relatedPostId);
          const rdmDelta = typeof o?.rdmDelta === "number" ? o.rdmDelta : 0;
          const actionKind =
            typeof o?.actionKind === "string" && o.actionKind.trim() ? o.actionKind.trim() : null;
          const recommendActionId =
            typeof o?.recommendActionId === "string" && o.recommendActionId.trim()
              ? o.recommendActionId.trim()
              : null;
          const recommendActionLabel =
            typeof o?.recommendActionLabel === "string" && o.recommendActionLabel.trim()
              ? o.recommendActionLabel.trim()
              : null;
          const recommendActionUrl =
            typeof o?.recommendActionUrl === "string" && o.recommendActionUrl.trim()
              ? o.recommendActionUrl.trim()
              : null;

          const nudgeGoalRaw = typeof o?.nudgeGoal === "string" ? o.nudgeGoal.trim() : "";
          const notificationTitle =
            typeof o?.notificationTitle === "string" && o.notificationTitle.trim()
              ? o.notificationTitle.trim()
              : null;

          const actionUrl = isAssignmentReminder
            ? `/classroom/${encodeURIComponent(
                p.classroom_id
              )}?tab=posts&post=${encodeURIComponent(relatedPostId ?? p.id)}`
            : nudgeGoalRaw === "restart_streak"
              ? "/home"
              : null;

          let title: string;
          if (isAssignmentReminder) {
            if (nudgeGoalRaw === "attempt_mock") {
              title = relatedTitle ? `Reminder: ${relatedTitle}` : "Assignment reminder";
            } else if (notificationTitle) {
              title = notificationTitle;
            } else {
              title = relatedTitle ? `Reminder: ${relatedTitle}` : "Assignment reminder";
            }
          } else {
            title = notificationTitle ?? "Advice from teacher";
          }

          const notif: Notification = {
            id: p.id,
            title,
            body: message || null,
            read: persistedSeen.has(p.id),
            action_url: actionUrl,
            created_at: p.created_at,
            type: "motivation",
            kind: isAssignmentReminder ? "assignment_reminder" : "counsel_message",
            rdmDelta,
            actionKind: actionKind ?? undefined,
            recommendActionId:
              recommendActionId === "attempt_targeted_mock" ||
              recommendActionId === "post_doubt" ||
              recommendActionId === "watch_recorded" ||
              recommendActionId === "concept_focus_resource" ||
              recommendActionId === "none"
                ? recommendActionId
                : undefined,
            recommendActionLabel: recommendActionLabel ?? undefined,
            recommendActionUrl: recommendActionUrl ?? undefined,
          };
          return notif;
        })
        .filter((x): x is Notification => x !== null);

      setNotifications(mine.slice(0, 20));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        read: seenIds.has(n.id),
      }))
    );
  }, [seenIds]);

  const unreadNotifications = notifications.filter((n) => !n.read);
  const readNotifications = notifications.filter((n) => n.read);
  const visibleNotifications = activeTab === "unread" ? unreadNotifications : readNotifications;
  const unread = unreadNotifications.length;

  const normalizeExternalUrl = (raw: string): string | null => {
    let s = raw.trim();
    if (!s) return null;
    while (s.startsWith("/")) s = s.slice(1);
    const httpIdx = s.indexOf("http");
    if (httpIdx > 0) s = s.slice(httpIdx);
    if (/^https\/\//i.test(s) === false && /^https\//i.test(s)) s = s.replace(/^https\//i, "https://");
    if (/^http\/\//i.test(s) === false && /^http\//i.test(s)) s = s.replace(/^http\//i, "http://");
    if (/^www\./i.test(s)) s = `https://${s}`;
    try {
      const u = new URL(s);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      return u.toString();
    } catch {
      return null;
    }
  };

  /** Single primary destination: in-app `action_url` first, else teacher-recommended link. */
  const primaryOpenHref = useMemo(() => {
    if (!selected) return null;
    const action = selected.action_url?.trim();
    if (action) return action;
    if (
      selected.recommendActionId &&
      selected.recommendActionId !== "none" &&
      selected.recommendActionUrl?.trim()
    ) {
      return selected.recommendActionUrl.trim();
    }
    return null;
  }, [selected]);

  const markRead = (id: string) => {
    if (seenKey) {
      setSeenIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        try {
          window.localStorage.setItem(seenKey, JSON.stringify(Array.from(next).slice(-300)));
        } catch {
          // ignore
        }
        return next;
      });
    }
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const openDetail = (n: Notification) => {
    markRead(n.id);
    setSelected(n);
    setDetailOpen(true);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="relative w-9 h-9 rounded-xl bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors">
            <Bell className="w-4.5 h-4.5 text-muted-foreground" suppressHydrationWarning />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-extrabold rounded-full flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0 rounded-2xl">
          <div className="p-4 border-b border-border/60 flex items-center justify-between gap-2">
            <h3 className="font-display text-sm text-foreground">Notifications</h3>
            <div className="inline-flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("unread")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  activeTab === "unread"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Unread
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("read")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  activeTab === "read"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Read
              </button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {visibleNotifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {activeTab === "unread" ? "No unread notifications" : "No read notifications"}
              </p>
            ) : (
              visibleNotifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    openDetail(n);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-border/30 hover:bg-muted/40 transition-colors ${
                    n.read ? "" : "bg-primary/5"
                  }`}
                >
                  <p className={`text-sm font-bold ${n.read ? "text-muted-foreground" : "text-foreground"}`}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {personalizeTeacherMotivationMessage(n.body, motivationStudentFirstName)}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setSelected(null);
        }}
      >
        <DialogContent className="w-[92vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold">
              {selected?.title ?? "Notification"}
            </DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3">
              {selected.kind === "counsel_message" ? (
                <>
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground shadow-sm">
                    {selected.body
                      ? personalizeTeacherMotivationMessage(selected.body, motivationStudentFirstName)
                      : ""}
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs font-semibold text-amber-100">
                    {typeof selected.rdmDelta === "number" && selected.rdmDelta > 0
                      ? `+${selected.rdmDelta} RDM encouragement included`
                      : "No RDM encouragement included"}
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selected.body
                    ? personalizeTeacherMotivationMessage(selected.body, motivationStudentFirstName)
                    : ""}
                </div>
              )}
            </div>
          ) : null}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-full border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-muted/40"
              onClick={() => setDetailOpen(false)}
            >
              Close
            </button>
            {primaryOpenHref ? (
              <button
                type="button"
                className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
                onClick={() => {
                  if (!primaryOpenHref) return;
                  if (primaryOpenHref.startsWith("/")) {
                    router.push(primaryOpenHref);
                  } else {
                    const normalized = normalizeExternalUrl(primaryOpenHref) ?? primaryOpenHref;
                    window.open(normalized, "_blank", "noopener,noreferrer");
                  }
                  setDetailOpen(false);
                  setOpen(false);
                }}
              >
                Open link →
              </button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NotificationBell;
