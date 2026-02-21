import { Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const template = `Dear IT Administrator,

I would like to request access to Google Classroom for educational purposes. Our learning platform (EduBlast/ESM) integrates with Google Classroom to sync assignments, attendance, and class materials.

Could you please:
1. Enable Google Classroom access for my account
2. Allow external student accounts to join (if applicable)

This will help streamline our classroom management and improve the learning experience.

Thank you for your time.`;

const AdminRequestTemplate = () => {
  const { toast } = useToast();

  return (
    <div className="bg-muted/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-extrabold text-foreground">Admin Request Template</h4>
        <button onClick={() => { navigator.clipboard.writeText(template); toast({ title: 'Template copied!' }); }}
          className="text-xs text-primary font-bold flex items-center gap-1 hover:underline">
          <Copy className="w-3 h-3" /> Copy
        </button>
      </div>
      <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{template}</pre>
    </div>
  );
};

export default AdminRequestTemplate;
