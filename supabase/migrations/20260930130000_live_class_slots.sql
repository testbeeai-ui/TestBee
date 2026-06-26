-- Explicit live-class slot booking (replaces open-ended recurring for new classes).

CREATE TABLE IF NOT EXISTS public.live_class_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.classroom_sections(id) ON DELETE CASCADE,
  slot_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  google_event_id text,
  meet_link text,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_class_slots_status_check
    CHECK (status = ANY (ARRAY['scheduled'::text, 'cancelled'::text])),
  CONSTRAINT live_class_slots_section_slot_key UNIQUE (section_id, slot_at)
);

CREATE INDEX IF NOT EXISTS live_class_slots_teacher_month_idx
  ON public.live_class_slots (teacher_id, slot_at);

CREATE INDEX IF NOT EXISTS live_class_slots_section_idx
  ON public.live_class_slots (section_id, slot_at);

COMMENT ON TABLE public.live_class_slots IS
  'One booked live class per row. Canonical occurrence for delivery + quality RDM.';

ALTER TABLE public.live_class_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS live_class_slots_teacher_all ON public.live_class_slots;
CREATE POLICY live_class_slots_teacher_all
  ON public.live_class_slots
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS live_class_slots_section_member_select ON public.live_class_slots;
CREATE POLICY live_class_slots_section_member_select
  ON public.live_class_slots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_members cm
      WHERE cm.classroom_id = live_class_slots.classroom_id
        AND cm.user_id = auth.uid()
    )
  );
