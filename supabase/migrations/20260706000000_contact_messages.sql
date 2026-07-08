-- Contact Us form submissions (public /contact page)
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  category text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  role text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  admin_status text NOT NULL DEFAULT 'new',
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_messages_category_check CHECK (category IN ('sales', 'issue', 'comment')),
  CONSTRAINT contact_messages_admin_status_check CHECK (admin_status IN ('new', 'reviewed', 'resolved'))
);

CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx
  ON public.contact_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS contact_messages_admin_status_idx
  ON public.contact_messages (admin_status, created_at DESC);

CREATE INDEX IF NOT EXISTS contact_messages_category_idx
  ON public.contact_messages (category, created_at DESC);

CREATE INDEX IF NOT EXISTS contact_messages_ticket_id_idx
  ON public.contact_messages (ticket_id);

COMMENT ON TABLE public.contact_messages IS 'Public Contact Us form submissions from /contact.';
COMMENT ON COLUMN public.contact_messages.payload IS 'Category-specific fields (sales/issue/comment form data).';
COMMENT ON COLUMN public.contact_messages.admin_status IS 'Admin triage: new | reviewed | resolved';

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY contact_messages_insert_public
  ON public.contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY contact_messages_select_admin
  ON public.contact_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::public.app_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(p.role)) = 'admin'
    )
  );

CREATE POLICY contact_messages_update_admin
  ON public.contact_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::public.app_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(p.role)) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::public.app_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(p.role)) = 'admin'
    )
  );

GRANT ALL ON TABLE public.contact_messages TO anon;
GRANT ALL ON TABLE public.contact_messages TO authenticated;
GRANT ALL ON TABLE public.contact_messages TO service_role;
