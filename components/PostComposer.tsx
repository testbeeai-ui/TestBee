import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { FileText, Video, HelpCircle, ClipboardList, BarChart3, Megaphone, X, Send } from 'lucide-react';

const contentTypes = [
  { type: 'concept', icon: FileText, label: 'Concept Post', emoji: '💡' },
  { type: 'video', icon: Video, label: 'Video Lesson', emoji: '🎬' },
  { type: 'quiz', icon: HelpCircle, label: 'Practice Quiz', emoji: '❓' },
  { type: 'assignment', icon: ClipboardList, label: 'Assignment', emoji: '📝' },
  { type: 'poll', icon: BarChart3, label: 'Poll / Debate', emoji: '📊' },
  { type: 'announcement', icon: Megaphone, label: 'Announcement', emoji: '📢' },
] as const;

type PostType = (typeof contentTypes)[number]['type'];

const postTypeConfig: Record<
  PostType,
  {
    subtitle: string;
    titlePlaceholder: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    showTags: boolean;
    showDueDate: boolean;
    dueDateLabel?: string;
    showVideoUrl: boolean;
  }
> = {
  announcement: {
    subtitle: 'Share a quick update with the class. No due date needed.',
    titlePlaceholder: 'Announcement title',
    descriptionLabel: 'Message',
    descriptionPlaceholder: 'What do you want to tell the class?',
    showTags: false,
    showDueDate: false,
    showVideoUrl: false,
  },
  assignment: {
    subtitle: 'Set a task with an optional due date and tags.',
    titlePlaceholder: 'Assignment title',
    descriptionLabel: 'Instructions',
    descriptionPlaceholder: 'Describe the task and what students need to submit.',
    showTags: true,
    showDueDate: true,
    dueDateLabel: 'Due date',
    showVideoUrl: false,
  },
  concept: {
    subtitle: 'Explain a concept or share learning material.',
    titlePlaceholder: 'Concept or topic title',
    descriptionLabel: 'Content',
    descriptionPlaceholder: 'Explain the concept, add notes or links.',
    showTags: true,
    showDueDate: false,
    showVideoUrl: false,
  },
  video: {
    subtitle: 'Share a video lesson. Add a link so students can watch.',
    titlePlaceholder: 'Video lesson title',
    descriptionLabel: 'Notes (optional)',
    descriptionPlaceholder: 'Brief context or discussion points.',
    showTags: false,
    showDueDate: true,
    dueDateLabel: 'Watch by (optional)',
    showVideoUrl: true,
  },
  quiz: {
    subtitle: 'Share a practice quiz. Set a deadline if needed.',
    titlePlaceholder: 'Quiz title',
    descriptionLabel: 'Instructions',
    descriptionPlaceholder: 'What to practice or how to attempt.',
    showTags: true,
    showDueDate: true,
    dueDateLabel: 'Complete by',
    showVideoUrl: false,
  },
  poll: {
    subtitle: 'Create a poll or debate topic. Set when it closes.',
    titlePlaceholder: 'Poll or debate title',
    descriptionLabel: 'Question / topic',
    descriptionPlaceholder: 'What are you asking or debating?',
    showTags: false,
    showDueDate: true,
    dueDateLabel: 'Closes at',
    showVideoUrl: false,
  },
};

interface Props {
  classroomId: string;
  onClose: () => void;
  onPublished: () => void;
}

const PostComposer = ({ classroomId, onClose, onPublished }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [postType, setPostType] = useState<PostType>('announcement');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [publishToGoogle, setPublishToGoogle] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const config = postTypeConfig[postType];

  const handlePublish = async () => {
    if (!title.trim() || !user) return;
    setPublishing(true);

    const contentJson =
      config.showVideoUrl && videoUrl.trim()
        ? ({ videoUrl: videoUrl.trim() } as Record<string, unknown>)
        : null;

    const { error } = await supabase.from('posts').insert({
      classroom_id: classroomId,
      teacher_id: user.id,
      type: postType,
      title: title.trim(),
      description: description.trim() || null,
      tags: config.showTags ? tags.split(',').map(t => t.trim()).filter(Boolean) : null,
      due_date: config.showDueDate && dueDate ? dueDate : null,
      content_json: contentJson as unknown as undefined,
      google_classroom_synced: publishToGoogle,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Published! 🎉' });
      onPublished();
    }
    setPublishing(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="edu-card p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-lg text-foreground">Create Post</h3>
        <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center" aria-label="Close">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
        {contentTypes.map(ct => (
          <button
            key={ct.type}
            type="button"
            onClick={() => setPostType(ct.type)}
            className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-xs font-bold transition-all ${postType === ct.type ? 'bg-primary/10 text-primary ring-2 ring-primary/30' : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'}`}
          >
            <span className="text-lg">{ct.emoji}</span>
            <span className="leading-tight text-center">{ct.label}</span>
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground mb-4">{config.subtitle}</p>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-extrabold text-foreground block mb-1.5">Title</label>
          <Input placeholder={config.titlePlaceholder} value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl h-12 font-bold" />
        </div>

        <div>
          <label className="text-xs font-extrabold text-foreground block mb-1.5">{config.descriptionLabel}</label>
          <Textarea placeholder={config.descriptionPlaceholder} value={description} onChange={e => setDescription(e.target.value)} className="rounded-xl min-h-[80px]" />
        </div>

        {config.showVideoUrl && (
          <div>
            <label className="text-xs font-extrabold text-foreground block mb-1.5">Video URL</label>
            <Input placeholder="https://..." value={videoUrl} onChange={e => setVideoUrl(e.target.value)} className="rounded-xl" type="url" />
          </div>
        )}

        {(config.showTags || config.showDueDate) && (
          <div className={`grid gap-3 ${config.showTags && config.showDueDate ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {config.showTags && (
              <div>
                <label className="text-xs font-extrabold text-foreground block mb-1.5">Tags (comma separated)</label>
                <Input placeholder="e.g. chapter5, homework" value={tags} onChange={e => setTags(e.target.value)} className="rounded-xl" />
              </div>
            )}
            {config.showDueDate && (
              <div>
                <label className="text-xs font-extrabold text-foreground block mb-1.5">{config.dueDateLabel ?? 'Due date'}</label>
                <Input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="rounded-xl" />
              </div>
            )}
          </div>
        )}

        {/* Publish destinations */}
        <div className="bg-muted/30 rounded-xl p-4 space-y-2.5">
          <p className="text-xs font-extrabold text-foreground">Publish to:</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked disabled />
            <span className="text-sm font-bold text-foreground">ESM Class Feed</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={publishToGoogle} onCheckedChange={v => setPublishToGoogle(!!v)} />
            <span className="text-sm font-medium text-muted-foreground">Also publish to Google Classroom</span>
            {publishToGoogle && <span className="text-xs font-bold text-primary">Will post as Material</span>}
            {!publishToGoogle && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-bold text-muted-foreground">Coming soon</span>}
          </label>
        </div>

        <Button onClick={handlePublish} disabled={!title.trim() || publishing} className="w-full rounded-xl edu-btn-primary h-12 font-extrabold gap-2">
          <Send className="w-4 h-4" /> {publishing ? 'Publishing...' : 'Publish'}
        </Button>
      </div>
    </motion.div>
  );
};

export default PostComposer;
