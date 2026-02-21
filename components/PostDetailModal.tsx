'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Video, HelpCircle, ClipboardList, BarChart3, Megaphone, Calendar, Pencil, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export interface PostDetailData {
  id: string;
  type: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  due_date: string | null;
  created_at: string;
  teacher_id: string;
  content_json?: { videoUrl?: string } | null;
  profiles: { name: string } | null;
}

const typeConfig: Record<string, { icon: typeof FileText; emoji: string; color: string }> = {
  concept: { icon: FileText, emoji: '💡', color: 'bg-blue-500/10 text-blue-600' },
  video: { icon: Video, emoji: '🎬', color: 'bg-purple-500/10 text-purple-600' },
  quiz: { icon: HelpCircle, emoji: '❓', color: 'bg-amber-500/10 text-amber-600' },
  assignment: { icon: ClipboardList, emoji: '📝', color: 'bg-green-500/10 text-green-600' },
  poll: { icon: BarChart3, emoji: '📊', color: 'bg-pink-500/10 text-pink-600' },
  announcement: { icon: Megaphone, emoji: '📢', color: 'bg-orange-500/10 text-orange-600' },
};

interface Props {
  post: PostDetailData | null;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  onUpdated: () => void;
}

export default function PostDetailModal({ post, open, onClose, canEdit, onUpdated }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (!post) return;
    setTitle(post.title);
    setDescription(post.description ?? '');
    setTagsStr((post.tags ?? []).join(', '));
    setDueDate(post.due_date ? new Date(post.due_date).toISOString().slice(0, 16) : '');
    setEditing(false);
  }, [post]);

  if (!post) return null;

  const cfg = typeConfig[post.type] || typeConfig.announcement;
  const videoUrl = (post.content_json as { videoUrl?: string } | null)?.videoUrl;

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('posts')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        tags: tagsStr.trim() ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      })
      .eq('id', post.id)
      .eq('teacher_id', post.teacher_id);

    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Post updated' });
    setEditing(false);
    onUpdated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${cfg.color}`}>
              {cfg.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                {post.type}
              </span>
              {!editing ? (
                <>
                  <h2 className="font-extrabold text-foreground text-lg mt-0.5">{post.title}</h2>
                  {post.due_date && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <Calendar className="w-3 h-3" /> Due {format(new Date(post.due_date), 'MMM d, yyyy h:mm a')}
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-2 mt-2">
                  <label className="text-xs font-extrabold text-foreground block">Title</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" />
                  <label className="text-xs font-extrabold text-foreground block">Description</label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl min-h-[100px]" />
                  <label className="text-xs font-extrabold text-foreground block">Tags (comma separated)</label>
                  <Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="e.g. chapter5, homework" className="rounded-xl" />
                  <label className="text-xs font-extrabold text-foreground block">Due date (optional)</label>
                  <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-xl" />
                </div>
              )}
            </div>
            {canEdit && !editing && (
              <Button variant="outline" size="sm" className="rounded-xl shrink-0 gap-1" onClick={() => setEditing(true)}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            )}
          </div>

          {!editing && (
            <>
              {post.description?.trim() && (
                <div className="text-sm text-foreground whitespace-pre-wrap rounded-xl bg-muted/30 p-4">
                  {post.description.trim()}
                </div>
              )}
              {videoUrl && (
                <div className="rounded-xl overflow-hidden bg-muted border border-border">
                  <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary font-bold hover:underline block p-3">
                    Watch video: {videoUrl}
                  </a>
                </div>
              )}
              {(post.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(post.tags ?? []).map((tag) => (
                    <span key={tag} className="edu-chip bg-muted text-muted-foreground text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground/80">
                {post.profiles?.name || 'Teacher'} · {format(new Date(post.created_at), 'MMM d, yyyy h:mm a')}
              </p>
            </>
          )}

          {editing && (
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button className="rounded-xl edu-btn-primary gap-2" disabled={saving || !title.trim()} onClick={handleSave}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save changes
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
