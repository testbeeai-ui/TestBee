import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy, Search, UserPlus, Upload, Link2 } from 'lucide-react';

interface Props {
  classroomId: string;
  joinCode: string;
}

const InviteStudents = ({ classroomId, joinCode }: Props) => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([]);
  const [searching, setSearching] = useState(false);

  const joinLink = `${window.location.origin}/join/${classroomId}`;

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    if (query.length < 2 || query.length > 50) {
      toast({ title: 'Search must be 2-50 characters' });
      return;
    }
    if (!/^[a-zA-Z0-9\s'\-\.]+$/.test(query)) {
      toast({ title: 'Invalid search characters' });
      return;
    }
    setSearching(true);
    const { data } = await supabase.from('profiles').select('id, name')
      .ilike('name', `%${query}%`)
      .neq('visibility', 'invite_only')
      .limit(10);
    setSearchResults((data as { id: string; name: string }[]) || []);
    setSearching(false);
  };

  const inviteUser = async (userId: string) => {
    const { error } = await supabase.from('classroom_members').insert({ classroom_id: classroomId, user_id: userId, role: 'student' });
    if (error) {
      if (error.code === '23505') toast({ title: 'Already a member!' });
      else toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Student added! 🎉' });
      setSearchResults(prev => prev.filter(u => u.id !== userId));
    }
  };

  return (
    <div className="space-y-6">
      {/* Method 1: Search */}
      <div>
        <h4 className="text-sm font-extrabold text-foreground mb-2 flex items-center gap-1.5">
          <Search className="w-4 h-4 text-primary" /> Search Users
        </h4>
        <p className="text-xs text-muted-foreground mb-2">Search among users in your classroom network</p>
        <div className="flex gap-2">
          <Input placeholder="Search by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} className="rounded-xl" />
          <Button onClick={handleSearch} disabled={searching} variant="outline" className="rounded-xl">Search</Button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {searchResults.map(u => (
              <div key={u.id} className="flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2">
                <span className="text-sm font-bold text-foreground">{u.name}</span>
                <Button size="sm" variant="ghost" onClick={() => inviteUser(u.id)} className="h-7 text-xs gap-1">
                  <UserPlus className="w-3 h-3" /> Add
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Method 2: Share link */}
      <div>
        <h4 className="text-sm font-extrabold text-foreground mb-2 flex items-center gap-1.5">
          <Link2 className="w-4 h-4 text-primary" /> Share Join Link
        </h4>
        <div className="flex gap-2">
          <Input readOnly value={joinLink} className="rounded-xl text-xs" />
          <Button variant="outline" className="rounded-xl gap-1" onClick={() => { navigator.clipboard.writeText(joinLink); toast({ title: 'Link copied!' }); }}>
            <Copy className="w-3.5 h-3.5" /> Copy
          </Button>
        </div>
      </div>

      {/* Method 2b: Join code */}
      <div>
        <h4 className="text-sm font-extrabold text-foreground mb-2">Join Code</h4>
        <button onClick={() => { navigator.clipboard.writeText(joinCode); toast({ title: 'Code copied!' }); }}
          className="bg-muted/50 px-4 py-2.5 rounded-xl font-mono text-lg font-extrabold tracking-widest text-foreground flex items-center gap-2 hover:bg-muted transition-colors">
          <Copy className="w-4 h-4 text-muted-foreground" /> {joinCode}
        </button>
      </div>

      {/* Method 3: Bulk */}
      <div>
        <h4 className="text-sm font-extrabold text-foreground mb-2 flex items-center gap-1.5">
          <Upload className="w-4 h-4 text-primary" /> Bulk Invite
        </h4>
        <div className="bg-muted/30 rounded-xl p-4 text-center">
          <p className="text-sm text-muted-foreground">CSV import coming soon!</p>
        </div>
      </div>
    </div>
  );
};

export default InviteStudents;
