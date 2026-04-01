'use client';

import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { TopicNode } from '@/data/topicTaxonomy';
import type { Subject } from '@/types';

interface ExploreSearchBarProps {
  taxonomy: TopicNode[];
  onSelectTopic: (subject: Subject, topic: string) => void;
}

export default function ExploreSearchBar({ taxonomy, onSelectTopic }: ExploreSearchBarProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const results = query.trim().length >= 2
    ? taxonomy
        .filter((t) => {
          const q = query.toLowerCase();
          return (
            t.topic.toLowerCase().includes(q) ||
            t.subject.toLowerCase().includes(q) ||
            t.subtopics.some((s) => s.name.toLowerCase().includes(q)) ||
            (t.chapterTitle?.toLowerCase().includes(q) ?? false)
          );
        })
        .slice(0, 8)
    : [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search any subject, chapter, topic or sub-topic..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          className="pl-10 h-11 rounded-xl border-border bg-muted/30 text-sm"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-border bg-card shadow-lg overflow-y-auto max-h-[60vh]">
          {results.map((t) => (
            <button
              key={`${t.subject}-${t.topic}`}
              type="button"
              onClick={() => {
                onSelectTopic(t.subject, t.topic);
                setQuery('');
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-muted/60 transition-colors flex items-center gap-3"
            >
              <span className="text-xs font-bold uppercase text-muted-foreground w-16 shrink-0">
                {t.subject}
              </span>
              <span className="text-sm font-medium text-foreground truncate">{t.topic}</span>
              {t.chapterTitle && (
                <span className="text-xs text-muted-foreground ml-auto truncate max-w-[140px]">
                  {t.chapterTitle}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
