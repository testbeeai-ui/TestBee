import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  action_url: string | null;
  created_at: string;
  type: string;
}

const NotificationBell = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setNotifications((data as Notification[]) || []));
  }, [user]);

  const unread = notifications.filter(n => !n.read).length;

  const markRead = async (id: string, actionUrl: string | null) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    if (actionUrl) { router.push(actionUrl); setOpen(false); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative w-9 h-9 rounded-xl bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors">
          <Bell className="w-4.5 h-4.5 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-extrabold rounded-full flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 rounded-2xl">
        <div className="p-4 border-b border-border/60">
          <h3 className="font-display text-sm text-foreground">Notifications</h3>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No notifications yet</p>
          ) : notifications.map(n => (
            <button key={n.id} onClick={() => markRead(n.id, n.action_url)}
              className={`w-full text-left px-4 py-3 border-b border-border/30 hover:bg-muted/40 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}>
              <p className={`text-sm font-bold ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>{n.title}</p>
              {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
