"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { safeGetSession } from "@/lib/auth/safeSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LEARN_HUB_SUBJECT_TITLE } from "@/lib/learnhub/routes";
import {
  NAMED_LINK_SUBJECTS,
  namedSlugError,
  normalizeNamedSlug,
  type NamedLinkDestination,
} from "@/lib/named-links/slug";
import type { Subject } from "@/types";

type AccountMatch = {
  id: string | null;
  email: string;
  name: string | null;
  role: string | null;
  source: "account" | "approved";
};

type NamedLink = {
  id: string;
  slug: string;
  email: string;
  display_name: string | null;
  destination: NamedLinkDestination;
  subject: Subject | null;
  created_at: string;
};

const SUBJECT_LABEL: Record<(typeof NAMED_LINK_SUBJECTS)[number], string> = {
  physics: LEARN_HUB_SUBJECT_TITLE.physics,
  chemistry: LEARN_HUB_SUBJECT_TITLE.chemistry,
  math: LEARN_HUB_SUBJECT_TITLE.math,
};

function pageLabel(link: Pick<NamedLink, "destination" | "subject">): string {
  const subjectLabel = link.subject ? SUBJECT_LABEL[link.subject] : "";
  if (link.destination === "learnhub") return `Learn Hub${subjectLabel ? ` · ${subjectLabel}` : ""}`;
  return `Chapter PYQ${subjectLabel ? ` · ${subjectLabel}` : ""}`;
}

function pagePath(link: Pick<NamedLink, "slug">): string {
  return `/${link.slug}`;
}

async function adminFetch(path: string, init?: RequestInit) {
  const { session } = await safeGetSession();
  if (!session?.access_token) throw new Error("Missing session token");
  const res = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body as Record<string, unknown>;
}

export default function NamedLinksPage() {
  const [links, setLinks] = useState<NamedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(false);
  const [matches, setMatches] = useState<AccountMatch[] | null>(null);
  const [selected, setSelected] = useState<AccountMatch | null>(null);
  const [destination, setDestination] = useState<NamedLinkDestination | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const body = await adminFetch("/api/admin/named-links");
      setLinks((body.links as NamedLink[] | undefined) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load name links");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const slug = normalizeNamedSlug(name);
  const slugProblem = name.trim() ? namedSlugError(name) : null;

  const checkEmail = async () => {
    setChecking(true);
    setError("");
    setMatches(null);
    setSelected(null);
    try {
      const body = await adminFetch(
        `/api/admin/named-links/lookup?email=${encodeURIComponent(email.trim())}`
      );
      setMatches((body.matches as AccountMatch[] | undefined) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check that email");
    } finally {
      setChecking(false);
    }
  };

  const save = async () => {
    if (!selected || !destination) return;
    setSaving(true);
    setError("");
    try {
      await adminFetch("/api/admin/named-links", {
        method: "POST",
        body: JSON.stringify({
          slug,
          userId: selected.id,
          email: selected.email,
          destination,
          subject,
        }),
      });
      setName("");
      setEmail("");
      setMatches(null);
      setSelected(null);
      setDestination(null);
      setSubject(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (link: NamedLink) => {
    if (!window.confirm(`Remove /${link.slug}?`)) return;
    setError("");
    try {
      await adminFetch(`/api/admin/named-links/${link.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove");
    }
  };

  const canSave =
    !slugProblem &&
    slug.length >= 2 &&
    selected != null &&
    destination != null &&
    subject != null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight md:text-2xl">
          <Link2 className="h-6 w-6 text-primary" />
          Name links
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          A short name in the address, tied to one email, opening a Learn Hub subject or Chapter
          PYQ. Login is left as it is.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <form
        className="space-y-5 rounded-2xl border bg-card p-4 md:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave && !saving) void save();
        }}
      >
        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor="named-link-name">
            Name
          </label>
          <Input
            id="named-link-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="name"
            autoComplete="off"
          />
          {slugProblem ? <p className="text-xs text-destructive">{slugProblem}</p> : null}
          {slug && !slugProblem ? (
            <p className="text-xs text-muted-foreground">
              Address: {origin ? `${origin}/${slug}` : `/${slug}`}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor="named-link-email">
            Email
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="named-link-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setSelected(null);
                setMatches(null);
              }}
              placeholder="name@email.com"
              autoComplete="off"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={checking || !email.includes("@")}
              onClick={() => void checkEmail()}
            >
              {checking ? "Checking…" : "Check email"}
            </Button>
          </div>
          {matches && matches.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              That email is not on the approved list.
            </p>
          ) : null}
          {matches && matches.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Select the email to link.</p>
              {matches.map((match) => {
                const active = selected?.email === match.email;
                return (
                  <button
                    key={match.email}
                    type="button"
                    onClick={() => setSelected(match)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${
                      active ? "border-primary bg-primary/10" : "hover:bg-muted"
                    }`}
                  >
                    <span>
                      <span className="font-medium">{match.email}</span>
                      {match.name ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">{match.name}</span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {match.source === "approved" ? "Approved list" : "Signed in"}
                      {match.role ? ` · ${match.role}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Page</legend>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={destination === "learnhub" ? "default" : "outline"}
              onClick={() => setDestination("learnhub")}
            >
              Learn Hub subject
            </Button>
            <Button
              type="button"
              variant={destination === "chapter_pyq" ? "default" : "outline"}
              onClick={() => setDestination("chapter_pyq")}
            >
              Chapter PYQ
            </Button>
          </div>
          {destination ? (
            <div className="flex flex-wrap gap-2">
              {NAMED_LINK_SUBJECTS.map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant={subject === item ? "default" : "outline"}
                  onClick={() => setSubject(item)}
                >
                  {SUBJECT_LABEL[item]}
                </Button>
              ))}
            </div>
          ) : null}
          {destination && subject ? (
            <p className="text-xs text-muted-foreground">
              Visitors open /{normalizeNamedSlug(name) || "name"}.
            </p>
          ) : null}
        </fieldset>

        <Button type="submit" disabled={!canSave || saving}>
          {saving ? "Saving…" : "Link this name"}
        </Button>
      </form>

      <div className="rounded-2xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Linked names</h2>
        </div>
        {loading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
        ) : links.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No names yet.</p>
        ) : (
          <ul className="divide-y">
            {links.map((link) => (
              <li key={link.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">/{link.slug}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {link.display_name ? `${link.display_name} · ` : ""}
                    {link.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pageLabel(link)} · {pagePath(link)}
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={() => void remove(link)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
