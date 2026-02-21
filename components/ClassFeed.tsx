import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Video, HelpCircle, ClipboardList, BarChart3, Megaphone, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export interface Post {
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
  classroomId: string;
  refreshKey?: number;
  onSelectPost?: (post: Post) => void;
  /** When set (e.g. from explorer-content API), use this instead of fetching from Supabase. */
  initialPosts?: Post[] | null;
}

const ClassFeed = ({ classroomId, refreshKey, onSelectPost, initialPosts }: Props) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialPosts !== undefined) {
      setPosts(initialPosts ?? []);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase.from('posts').select('*, profiles!posts_teacher_id_fkey(name)')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPosts((data as unknown as Post[]) || []);
        setLoading(false);
      });
  }, [classroomId, refreshKey, initialPosts]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="edu-card rounded-2xl p-5 min-h-[180px] animate-pulse bg-muted/30" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) return (
    <div className="text-center py-12">
      <span className="text-4xl block mb-3">📝</span>
      <p className="text-muted-foreground text-sm">No posts yet. Teachers can create the first post!</p>
    </div>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {posts.map(post => {
        const cfg = typeConfig[post.type] || typeConfig.announcement;
        const cardContent = (
          <div className="flex flex-col h-full text-left">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${cfg.color}`}>
                {cfg.emoji}
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">{post.type}</span>
            </div>
            <h4 className="font-extrabold text-foreground text-sm leading-tight line-clamp-2 mb-1">{post.title}</h4>
            {post.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 flex-1 min-h-0">{post.description}</p>
            )}
            {post.due_date && (
              <p className="text-[10px] font-bold text-destructive flex items-center gap-0.5 mt-2">
                <Calendar className="w-3 h-3 shrink-0" /> Due {format(new Date(post.due_date), 'MMM d')}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground/70 mt-auto pt-3">
              {post.profiles?.name || 'Teacher'} · {format(new Date(post.created_at), 'MMM d')}
            </p>
          </div>
        );

        const cardClass = 'edu-card rounded-2xl p-5 min-h-[180px] transition-all flex flex-col hover:border-primary/30 hover:shadow-md';
        return (
          <div key={post.id} className="flex">
            {onSelectPost ? (
              <button
                type="button"
                onClick={() => onSelectPost(post)}
                className={`${cardClass} w-full cursor-pointer text-left`}
              >
                {cardContent}
              </button>
            ) : (
              <div className={`${cardClass} w-full`}>
                {cardContent}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ClassFeed;
