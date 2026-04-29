import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Upload, Link2 } from "lucide-react";

interface Props {
  classroomId: string;
  joinCode: string;
}

const InviteStudents = ({ classroomId, joinCode }: Props) => {
  const { toast } = useToast();

  const joinLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    const code = (joinCode ?? "").trim();
    const u = new URL(`${window.location.origin}/join`);
    if (code) u.searchParams.set("code", code);
    return u.toString();
  }, [joinCode]);

  return (
    <div className="space-y-6">
      {/* Method 1: Share link */}
      <div>
        <h4 className="text-sm font-extrabold text-foreground mb-2 flex items-center gap-1.5">
          <Link2 className="w-4 h-4 text-primary" /> Share Join Link
        </h4>
        <p className="text-xs text-muted-foreground mb-2">
          Students will be asked to sign in, then they can send a join request. You approve it from
          the teacher portal.
        </p>
        <div className="flex gap-2">
          <Input readOnly value={joinLink} className="rounded-xl text-xs" />
          <Button
            variant="outline"
            className="rounded-xl gap-1"
            onClick={() => {
              navigator.clipboard.writeText(joinLink);
              toast({ title: "Link copied!" });
            }}
          >
            <Copy className="w-3.5 h-3.5" /> Copy
          </Button>
        </div>
      </div>

      {/* Method 2: Join code */}
      <div>
        <h4 className="text-sm font-extrabold text-foreground mb-2">Join Code</h4>
        <button
          onClick={() => {
            navigator.clipboard.writeText(joinCode);
            toast({ title: "Code copied!" });
          }}
          className="bg-muted/50 px-4 py-2.5 rounded-xl font-mono text-lg font-extrabold tracking-widest text-foreground flex items-center gap-2 hover:bg-muted transition-colors"
        >
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
