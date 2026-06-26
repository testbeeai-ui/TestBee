export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accepted_answer_payouts: {
        Row: {
          answer_id: string
          id: string
          paid_at: string
          rdm_paid: number
          user_id: string
        }
        Insert: {
          answer_id: string
          id?: string
          paid_at?: string
          rdm_paid: number
          user_id: string
        }
        Update: {
          answer_id?: string
          id?: string
          paid_at?: string
          rdm_paid?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accepted_answer_payouts_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "doubt_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accepted_answer_payouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_analytics_cache: {
        Row: {
          data: Json
          key: string
          refreshed_at: string
        }
        Insert: {
          data: Json
          key: string
          refreshed_at?: string
        }
        Update: {
          data?: Json
          key?: string
          refreshed_at?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: string
          payload: Json | null
          reason: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          id?: string
          payload?: Json | null
          reason?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          payload?: Json | null
          reason?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_user_actions: {
        Row: {
          action_type: string
          actor_user_id: string
          created_at: string
          id: string
          new_state: Json
          old_state: Json
          reason: string | null
          target_user_id: string
        }
        Insert: {
          action_type: string
          actor_user_id: string
          created_at?: string
          id?: string
          new_state?: Json
          old_state?: Json
          reason?: string | null
          target_user_id: string
        }
        Update: {
          action_type?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          new_state?: Json
          old_state?: Json
          reason?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      ai_token_logs: {
        Row: {
          action_type: string
          backend: string
          candidates_tokens: number
          cost_usd: number
          created_at: string
          id: string
          metadata: Json
          model_id: string
          prompt_tokens: number
          total_tokens: number
          user_id: string | null
        }
        Insert: {
          action_type: string
          backend?: string
          candidates_tokens?: number
          cost_usd?: number
          created_at?: string
          id?: string
          metadata?: Json
          model_id?: string
          prompt_tokens?: number
          total_tokens?: number
          user_id?: string | null
        }
        Update: {
          action_type?: string
          backend?: string
          candidates_tokens?: number
          cost_usd?: number
          created_at?: string
          id?: string
          metadata?: Json
          model_id?: string
          prompt_tokens?: number
          total_tokens?: number
          user_id?: string | null
        }
        Relationships: []
      }
      approved_emails: {
        Row: {
          approved_by: string | null
          approved_via: string | null
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          role: string
          waitlist_submission_id: string | null
        }
        Insert: {
          approved_by?: string | null
          approved_via?: string | null
          created_at?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          role: string
          waitlist_submission_id?: string | null
        }
        Update: {
          approved_by?: string | null
          approved_via?: string | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string
          waitlist_submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approved_emails_waitlist_submission_id_fkey"
            columns: ["waitlist_submission_id"]
            isOneToOne: false
            referencedRelation: "waitlist_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_invites: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          created_at: string
          expires_at: string
          id: string
          inviter_user_id: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          inviter_user_id: string
          status?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          inviter_user_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_invites_accepted_by_user_id_fkey"
            columns: ["accepted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_invites_inviter_user_id_fkey"
            columns: ["inviter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cbse_mcq_chapters: {
        Row: {
          board: string
          chapter_id: string
          chapter_name: string
          class_level: number
          created_at: string
          sort_order: number
          subject: string
        }
        Insert: {
          board?: string
          chapter_id: string
          chapter_name: string
          class_level?: number
          created_at?: string
          sort_order: number
          subject: string
        }
        Update: {
          board?: string
          chapter_id?: string
          chapter_name?: string
          class_level?: number
          created_at?: string
          sort_order?: number
          subject?: string
        }
        Relationships: []
      }
      cbse_mcq_community_share_rdm_claims: {
        Row: {
          attempt_key: string
          created_at: string
          id: string
          post_id: string
          rdm_amount: number
          user_id: string
        }
        Insert: {
          attempt_key: string
          created_at?: string
          id?: string
          post_id: string
          rdm_amount: number
          user_id: string
        }
        Update: {
          attempt_key?: string
          created_at?: string
          id?: string
          post_id?: string
          rdm_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cbse_mcq_community_share_rdm_claims_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "lessons_raw_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      cbse_mcq_score_bonus_claims: {
        Row: {
          accuracy_pct: number
          attempt_key: string
          correct_count: number
          created_at: string
          eligible: boolean
          id: string
          paper_id: string
          rdm_amount: number
          total_questions: number
          user_id: string
        }
        Insert: {
          accuracy_pct: number
          attempt_key: string
          correct_count: number
          created_at?: string
          eligible?: boolean
          id?: string
          paper_id: string
          rdm_amount: number
          total_questions: number
          user_id: string
        }
        Update: {
          accuracy_pct?: number
          attempt_key?: string
          correct_count?: number
          created_at?: string
          eligible?: boolean
          id?: string
          paper_id?: string
          rdm_amount?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cbse_mcq_score_bonus_claims_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "mock_papers"
            referencedColumns: ["id"]
          },
        ]
      }
      class_exploration_sessions: {
        Row: {
          classroom_id: string
          id: string
          started_at: string
          user_id: string
        }
        Insert: {
          classroom_id: string
          id?: string
          started_at?: string
          user_id: string
        }
        Update: {
          classroom_id?: string
          id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_exploration_sessions_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_exploration_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_assignment_responses: {
        Row: {
          classroom_id: string
          created_at: string
          id: string
          links: string[] | null
          post_id: string
          response_text: string | null
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          id?: string
          links?: string[] | null
          post_id: string
          response_text?: string | null
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          id?: string
          links?: string[] | null
          post_id?: string
          response_text?: string | null
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_assignment_responses_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_assignment_responses_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_assignment_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_assignment_task_progress: {
        Row: {
          completed_at: string
          id: string
          post_id: string
          task_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          post_id: string
          task_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          post_id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_assignment_task_progress_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_assignment_task_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_generated_test_attempts: {
        Row: {
          answers_json: Json
          classroom_id: string
          created_at: string
          id: string
          post_id: string
          score: number
          submitted_at: string | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          answers_json?: Json
          classroom_id: string
          created_at?: string
          id?: string
          post_id: string
          score?: number
          submitted_at?: string | null
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          answers_json?: Json
          classroom_id?: string
          created_at?: string
          id?: string
          post_id?: string
          score?: number
          submitted_at?: string | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_generated_test_attempts_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_generated_test_attempts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_generated_test_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_invite_batches: {
        Row: {
          classroom_id: string
          created_at: string
          flat_reward_granted: boolean
          flat_reward_rdm: number
          id: string
          invited_count: number
          teacher_id: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          flat_reward_granted?: boolean
          flat_reward_rdm?: number
          id?: string
          invited_count?: number
          teacher_id: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          flat_reward_granted?: boolean
          flat_reward_rdm?: number
          id?: string
          invited_count?: number
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_invite_batches_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_invite_batches_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_invite_recipients: {
        Row: {
          batch_id: string
          classroom_id: string
          email: string
          id: string
          invited_at: string
          linked_at: string | null
          linked_user_id: string | null
          paid_bonus_awarded_at: string | null
          teacher_id: string
        }
        Insert: {
          batch_id: string
          classroom_id: string
          email: string
          id?: string
          invited_at?: string
          linked_at?: string | null
          linked_user_id?: string | null
          paid_bonus_awarded_at?: string | null
          teacher_id: string
        }
        Update: {
          batch_id?: string
          classroom_id?: string
          email?: string
          id?: string
          invited_at?: string
          linked_at?: string | null
          linked_user_id?: string | null
          paid_bonus_awarded_at?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_invite_recipients_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "classroom_invite_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_invite_recipients_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_invite_recipients_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_invite_recipients_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_join_requests: {
        Row: {
          classroom_id: string
          created_at: string
          id: string
          responded_at: string | null
          responded_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          id?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          id?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_join_requests_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_join_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_members: {
        Row: {
          classroom_id: string
          google_synced: boolean
          id: string
          joined_at: string
          role: string
          section_id: string | null
          user_id: string
        }
        Insert: {
          classroom_id: string
          google_synced?: boolean
          id?: string
          joined_at?: string
          role?: string
          section_id?: string | null
          user_id: string
        }
        Update: {
          classroom_id?: string
          google_synced?: boolean
          id?: string
          joined_at?: string
          role?: string
          section_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_members_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_members_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "classroom_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_reviews: {
        Row: {
          classroom_id: string
          comment: string | null
          created_at: string | null
          id: string
          is_explorer: boolean | null
          rating: number
          updated_at: string | null
          user_id: string
          video_rating: number | null
          voice_rating: number | null
        }
        Insert: {
          classroom_id: string
          comment?: string | null
          created_at?: string | null
          id?: string
          is_explorer?: boolean | null
          rating: number
          updated_at?: string | null
          user_id: string
          video_rating?: number | null
          voice_rating?: number | null
        }
        Update: {
          classroom_id?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          is_explorer?: boolean | null
          rating?: number
          updated_at?: string | null
          user_id?: string
          video_rating?: number | null
          voice_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "classroom_reviews_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_sections: {
        Row: {
          archived_at: string | null
          classroom_id: string
          created_at: string
          duration_minutes: number | null
          google_calendar_list_id: string
          google_meet_link: string | null
          google_recurrence_end_date: string | null
          google_recurring_event_id: string | null
          google_rrule: string | null
          google_time_zone: string | null
          id: string
          is_active: boolean
          name: string
          repeat_days: string[] | null
          schedule_date: string | null
          schedule_end_date: string | null
          schedule_time: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          classroom_id: string
          created_at?: string
          duration_minutes?: number | null
          google_calendar_list_id?: string
          google_meet_link?: string | null
          google_recurrence_end_date?: string | null
          google_recurring_event_id?: string | null
          google_rrule?: string | null
          google_time_zone?: string | null
          id?: string
          is_active?: boolean
          name: string
          repeat_days?: string[] | null
          schedule_date?: string | null
          schedule_end_date?: string | null
          schedule_time?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          classroom_id?: string
          created_at?: string
          duration_minutes?: number | null
          google_calendar_list_id?: string
          google_meet_link?: string | null
          google_recurrence_end_date?: string | null
          google_recurring_event_id?: string | null
          google_rrule?: string | null
          google_time_zone?: string | null
          id?: string
          is_active?: boolean
          name?: string
          repeat_days?: string[] | null
          schedule_date?: string | null
          schedule_end_date?: string | null
          schedule_time?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_sections_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      classrooms: {
        Row: {
          allow_adhoc_trial: boolean
          created_at: string
          description: string | null
          google_calendar_list_id: string | null
          google_classroom_id: string | null
          google_meet_link: string | null
          google_recurrence_end_date: string | null
          google_recurring_event_id: string | null
          google_rrule: string | null
          google_time_zone: string | null
          id: string
          intro_video_url: string | null
          invite_link: string | null
          join_code: string
          name: string
          section: string | null
          subject: string | null
          teacher_id: string
          type: string
          updated_at: string
        }
        Insert: {
          allow_adhoc_trial?: boolean
          created_at?: string
          description?: string | null
          google_calendar_list_id?: string | null
          google_classroom_id?: string | null
          google_meet_link?: string | null
          google_recurrence_end_date?: string | null
          google_recurring_event_id?: string | null
          google_rrule?: string | null
          google_time_zone?: string | null
          id?: string
          intro_video_url?: string | null
          invite_link?: string | null
          join_code?: string
          name: string
          section?: string | null
          subject?: string | null
          teacher_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          allow_adhoc_trial?: boolean
          created_at?: string
          description?: string | null
          google_calendar_list_id?: string | null
          google_classroom_id?: string | null
          google_meet_link?: string | null
          google_recurrence_end_date?: string | null
          google_recurring_event_id?: string | null
          google_rrule?: string | null
          google_time_zone?: string | null
          id?: string
          intro_video_url?: string | null
          invite_link?: string | null
          join_code?: string
          name?: string
          section?: string | null
          subject?: string | null
          teacher_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classrooms_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          bought_by_teacher_id: string | null
          code: string
          created_at: string
          id: string
          is_purchased: boolean
          order_id: string | null
          payment_method: string | null
          rdm_amount: number
          redeemed_at: string | null
          redeemed_by_teacher_id: string | null
          restricted_to_teacher_ids: string[] | null
          status: string
        }
        Insert: {
          bought_by_teacher_id?: string | null
          code: string
          created_at?: string
          id?: string
          is_purchased?: boolean
          order_id?: string | null
          payment_method?: string | null
          rdm_amount: number
          redeemed_at?: string | null
          redeemed_by_teacher_id?: string | null
          restricted_to_teacher_ids?: string[] | null
          status?: string
        }
        Update: {
          bought_by_teacher_id?: string | null
          code?: string
          created_at?: string
          id?: string
          is_purchased?: boolean
          order_id?: string | null
          payment_method?: string | null
          rdm_amount?: number
          redeemed_at?: string | null
          redeemed_by_teacher_id?: string | null
          restricted_to_teacher_ids?: string[] | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_bought_by_teacher_id_fkey"
            columns: ["bought_by_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_redeemed_by_teacher_id_fkey"
            columns: ["redeemed_by_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_chapters: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          title: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          title: string
          unit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_chapters_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "curriculum_units"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_subtopics: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          topic_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          topic_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_subtopics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_topics: {
        Row: {
          chapter_id: string
          created_at: string
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_topics_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "curriculum_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_units: {
        Row: {
          class_level: number
          created_at: string
          exam_relevance: string[]
          id: string
          sort_order: number
          subject: string
          unit_label: string
          unit_title: string
        }
        Insert: {
          class_level: number
          created_at?: string
          exam_relevance?: string[]
          id?: string
          sort_order?: number
          subject: string
          unit_label: string
          unit_title: string
        }
        Update: {
          class_level?: number
          created_at?: string
          exam_relevance?: string[]
          id?: string
          sort_order?: number
          subject?: string
          unit_label?: string
          unit_title?: string
        }
        Relationships: []
      }
      daily_gauntlet_attempts: {
        Row: {
          completed_at: string
          correct_count: number
          domain: string
          gauntlet_date: string
          id: string
          total_time_ms: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          correct_count: number
          domain?: string
          gauntlet_date: string
          id?: string
          total_time_ms: number
          user_id: string
        }
        Update: {
          completed_at?: string
          correct_count?: number
          domain?: string
          gauntlet_date?: string
          id?: string
          total_time_ms?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_gauntlet_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reward_claims: {
        Row: {
          action_type: string
          claim_date_ist: string
          created_at: string
          id: string
          points_awarded: number
          user_id: string
        }
        Insert: {
          action_type: string
          claim_date_ist: string
          created_at?: string
          id?: string
          points_awarded: number
          user_id: string
        }
        Update: {
          action_type?: string
          claim_date_ist?: string
          created_at?: string
          id?: string
          points_awarded?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reward_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doubt_answer_reports: {
        Row: {
          answer_id: string
          created_at: string
          id: string
          reason: string
          reporter_user_id: string
        }
        Insert: {
          answer_id: string
          created_at?: string
          id?: string
          reason?: string
          reporter_user_id: string
        }
        Update: {
          answer_id?: string
          created_at?: string
          id?: string
          reason?: string
          reporter_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubt_answer_reports_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "doubt_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubt_answer_reports_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doubt_answers: {
        Row: {
          body: string
          created_at: string
          doubt_id: string
          downvotes: number
          hidden: boolean
          id: string
          is_accepted: boolean
          upvotes: number
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          doubt_id: string
          downvotes?: number
          hidden?: boolean
          id?: string
          is_accepted?: boolean
          upvotes?: number
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          doubt_id?: string
          downvotes?: number
          hidden?: boolean
          id?: string
          is_accepted?: boolean
          upvotes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubt_answers_doubt_id_fkey"
            columns: ["doubt_id"]
            isOneToOne: false
            referencedRelation: "doubts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubt_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doubt_saves: {
        Row: {
          created_at: string
          doubt_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doubt_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          doubt_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubt_saves_doubt_id_fkey"
            columns: ["doubt_id"]
            isOneToOne: false
            referencedRelation: "doubts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubt_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doubt_votes: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: string
          user_id: string
          vote_type: number
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: string
          user_id: string
          vote_type: number
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
          vote_type?: number
        }
        Relationships: [
          {
            foreignKeyName: "doubt_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doubts: {
        Row: {
          body: string
          bounty_escrowed_at: string | null
          bounty_rdm: number
          cost_rdm: number
          created_at: string
          downvotes: number
          gyan_curriculum_node_id: string | null
          id: string
          is_resolved: boolean
          subject: string | null
          title: string
          upvotes: number
          user_id: string
          views: number
        }
        Insert: {
          body?: string
          bounty_escrowed_at?: string | null
          bounty_rdm?: number
          cost_rdm?: number
          created_at?: string
          downvotes?: number
          gyan_curriculum_node_id?: string | null
          id?: string
          is_resolved?: boolean
          subject?: string | null
          title: string
          upvotes?: number
          user_id: string
          views?: number
        }
        Update: {
          body?: string
          bounty_escrowed_at?: string | null
          bounty_rdm?: number
          cost_rdm?: number
          created_at?: string
          downvotes?: number
          gyan_curriculum_node_id?: string | null
          id?: string
          is_resolved?: boolean
          subject?: string | null
          title?: string
          upvotes?: number
          user_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "doubts_gyan_curriculum_node_id_fkey"
            columns: ["gyan_curriculum_node_id"]
            isOneToOne: false
            referencedRelation: "gyan_curriculum_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      episodic_memory: {
        Row: {
          chunk_text: string
          context_key: string
          created_at: string
          embedding: string
          id: string
          user_id: string
        }
        Insert: {
          chunk_text: string
          context_key?: string
          created_at?: string
          embedding: string
          id?: string
          user_id: string
        }
        Update: {
          chunk_text?: string
          context_key?: string
          created_at?: string
          embedding?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      explorer_live_joins: {
        Row: {
          id: string
          joined_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "explorer_live_joins_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "explorer_live_joins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gyan_bot_config: {
        Row: {
          active: boolean
          current_student_index: number
          curriculum_batch_slot: number
          curriculum_sequence_index: number
          id: number
          interval_minutes: number
          last_post_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          current_student_index?: number
          curriculum_batch_slot?: number
          curriculum_sequence_index?: number
          id?: number
          interval_minutes?: number
          last_post_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          current_student_index?: number
          curriculum_batch_slot?: number
          curriculum_sequence_index?: number
          id?: number
          interval_minutes?: number
          last_post_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gyan_curriculum_nodes: {
        Row: {
          chapter_key: string
          chapter_label: string
          class_level: number
          created_at: string
          id: string
          rag_query_hint: string
          sort_order: number
          subject: string
          subtopic_key: string | null
          subtopic_label: string | null
          topic_key: string
          topic_label: string
        }
        Insert: {
          chapter_key: string
          chapter_label: string
          class_level: number
          created_at?: string
          id?: string
          rag_query_hint: string
          sort_order: number
          subject: string
          subtopic_key?: string | null
          subtopic_label?: string | null
          topic_key: string
          topic_label: string
        }
        Update: {
          chapter_key?: string
          chapter_label?: string
          class_level?: number
          created_at?: string
          id?: string
          rag_query_hint?: string
          sort_order?: number
          subject?: string
          subtopic_key?: string | null
          subtopic_label?: string | null
          topic_key?: string
          topic_label?: string
        }
        Relationships: []
      }
      inactive_day_penalties: {
        Row: {
          day: string
          penalized_at: string
          penalty_rdm: number
          user_id: string
        }
        Insert: {
          day: string
          penalized_at?: string
          penalty_rdm: number
          user_id: string
        }
        Update: {
          day?: string
          penalized_at?: string
          penalty_rdm?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inactive_day_penalties_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons_raw_post_boosts: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_raw_post_boosts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "lessons_raw_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_raw_post_boosts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons_raw_post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_raw_post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "lessons_raw_post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_raw_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "lessons_raw_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_raw_post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons_raw_post_votes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
          vote: number
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
          vote: number
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
          vote?: number
        }
        Relationships: [
          {
            foreignKeyName: "lessons_raw_post_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "lessons_raw_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_raw_post_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons_raw_posts: {
        Row: {
          board_ref: string | null
          boost_count: number
          chapter_ref: string | null
          comment_count: number
          content: string
          created_at: string
          downvote_count: number
          grade_ref: string | null
          id: string
          kind: string
          source_payload: Json | null
          source_type: string | null
          subject: string | null
          subtopic_ref: string | null
          tags: string[]
          title: string
          topic_ref: string | null
          unit_ref: string | null
          updated_at: string
          upvote_count: number
          user_id: string
        }
        Insert: {
          board_ref?: string | null
          boost_count?: number
          chapter_ref?: string | null
          comment_count?: number
          content: string
          created_at?: string
          downvote_count?: number
          grade_ref?: string | null
          id?: string
          kind: string
          source_payload?: Json | null
          source_type?: string | null
          subject?: string | null
          subtopic_ref?: string | null
          tags?: string[]
          title?: string
          topic_ref?: string | null
          unit_ref?: string | null
          updated_at?: string
          upvote_count?: number
          user_id: string
        }
        Update: {
          board_ref?: string | null
          boost_count?: number
          chapter_ref?: string | null
          comment_count?: number
          content?: string
          created_at?: string
          downvote_count?: number
          grade_ref?: string | null
          id?: string
          kind?: string
          source_payload?: Json | null
          source_type?: string | null
          subject?: string | null
          subtopic_ref?: string | null
          tags?: string[]
          title?: string
          topic_ref?: string | null
          unit_ref?: string | null
          updated_at?: string
          upvote_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_raw_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_class_ratings: {
        Row: {
          classroom_id: string
          created_at: string
          id: string
          occurrence_at: string
          section_id: string
          stars: number
          student_id: string
          updated_at: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          id?: string
          occurrence_at: string
          section_id: string
          stars: number
          student_id: string
          updated_at?: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          id?: string
          occurrence_at?: string
          section_id?: string
          stars?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_class_ratings_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_class_ratings_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "classroom_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_class_ratings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_class_slots: {
        Row: {
          classroom_id: string
          created_at: string
          duration_minutes: number
          google_event_id: string | null
          id: string
          meet_link: string | null
          section_id: string
          slot_at: string
          status: string
          teacher_id: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          duration_minutes?: number
          google_event_id?: string | null
          id?: string
          meet_link?: string | null
          section_id: string
          slot_at: string
          status?: string
          teacher_id: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          duration_minutes?: number
          google_event_id?: string | null
          id?: string
          meet_link?: string | null
          section_id?: string
          slot_at?: string
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_class_slots_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_class_slots_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "classroom_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_class_slots_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_session_joins: {
        Row: {
          credits_deducted: number
          id: string
          joined_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          credits_deducted?: number
          id?: string
          joined_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          credits_deducted?: number
          id?: string
          joined_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_session_joins_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_session_joins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          attendance_code: string | null
          classroom_id: string
          created_at: string
          duration_minutes: number
          id: string
          meet_link: string | null
          plan_json: Json | null
          post_assignment_post_id: string | null
          pre_assignment_post_id: string | null
          recap_post_id: string | null
          recording_url: string | null
          scheduled_at: string
          section_id: string | null
          status: string
          teacher_id: string
          title: string
        }
        Insert: {
          attendance_code?: string | null
          classroom_id: string
          created_at?: string
          duration_minutes?: number
          id?: string
          meet_link?: string | null
          plan_json?: Json | null
          post_assignment_post_id?: string | null
          pre_assignment_post_id?: string | null
          recap_post_id?: string | null
          recording_url?: string | null
          scheduled_at: string
          section_id?: string | null
          status?: string
          teacher_id: string
          title: string
        }
        Update: {
          attendance_code?: string | null
          classroom_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          meet_link?: string | null
          plan_json?: Json | null
          post_assignment_post_id?: string | null
          pre_assignment_post_id?: string | null
          recap_post_id?: string | null
          recording_url?: string | null
          scheduled_at?: string
          section_id?: string | null
          status?: string
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_post_assignment_post_id_fkey"
            columns: ["post_assignment_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_pre_assignment_post_id_fkey"
            columns: ["pre_assignment_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_recap_post_id_fkey"
            columns: ["recap_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "classroom_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_wall_basket_items: {
        Row: {
          board: string
          chapter_title: string | null
          class_level: number
          created_at: string
          exam_type: string | null
          id: string
          source: string
          subject: string
          topic_key: string
          topic_name: string
          unit_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          board?: string
          chapter_title?: string | null
          class_level: number
          created_at?: string
          exam_type?: string | null
          id?: string
          source?: string
          subject: string
          topic_key: string
          topic_name: string
          unit_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          board?: string
          chapter_title?: string | null
          class_level?: number
          created_at?: string
          exam_type?: string | null
          id?: string
          source?: string
          subject?: string
          topic_key?: string
          topic_name?: string
          unit_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "magic_wall_basket_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_wall_topic_attempts: {
        Row: {
          attempted_at: string
          id: string
          topic_key: string
          user_id: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          topic_key: string
          user_id: string
        }
        Update: {
          attempted_at?: string
          id?: string
          topic_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "magic_wall_topic_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_community_share_rdm_claims: {
        Row: {
          attempt_key: string
          created_at: string
          id: string
          post_id: string
          rdm_amount: number
          user_id: string
        }
        Insert: {
          attempt_key: string
          created_at?: string
          id?: string
          post_id: string
          rdm_amount?: number
          user_id: string
        }
        Update: {
          attempt_key?: string
          created_at?: string
          id?: string
          post_id?: string
          rdm_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_community_share_rdm_claims_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "lessons_raw_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_community_share_rdm_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_papers: {
        Row: {
          board: string | null
          chapter_id: string | null
          class_level: number
          created_at: string
          duration_minutes: number
          exam_name: string | null
          exam_set_name: string | null
          id: string
          marking_scheme: string
          paper_type: string
          published: boolean
          question_count: number
          slug: string
          subjects_covered: string[]
          tags: string[]
          title: string
          total_marks: number
        }
        Insert: {
          board?: string | null
          chapter_id?: string | null
          class_level?: number
          created_at?: string
          duration_minutes?: number
          exam_name?: string | null
          exam_set_name?: string | null
          id?: string
          marking_scheme?: string
          paper_type?: string
          published?: boolean
          question_count?: number
          slug: string
          subjects_covered?: string[]
          tags?: string[]
          title: string
          total_marks?: number
        }
        Update: {
          board?: string | null
          chapter_id?: string | null
          class_level?: number
          created_at?: string
          duration_minutes?: number
          exam_name?: string | null
          exam_set_name?: string | null
          id?: string
          marking_scheme?: string
          paper_type?: string
          published?: boolean
          question_count?: number
          slug?: string
          subjects_covered?: string[]
          tags?: string[]
          title?: string
          total_marks?: number
        }
        Relationships: [
          {
            foreignKeyName: "mock_papers_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "cbse_mcq_chapters"
            referencedColumns: ["chapter_id"]
          },
        ]
      }
      mock_questions: {
        Row: {
          chapter: string | null
          correct_letter: string
          difficulty: string | null
          id: string
          options_json: Json
          paper_id: string
          question_html: string
          solution_html: string | null
          sort_order: number
          source_question_id: string | null
          subject: string
          topic: string | null
        }
        Insert: {
          chapter?: string | null
          correct_letter: string
          difficulty?: string | null
          id?: string
          options_json: Json
          paper_id: string
          question_html: string
          solution_html?: string | null
          sort_order: number
          source_question_id?: string | null
          subject: string
          topic?: string | null
        }
        Update: {
          chapter?: string | null
          correct_letter?: string
          difficulty?: string | null
          id?: string
          options_json?: Json
          paper_id?: string
          question_html?: string
          solution_html?: string | null
          sort_order?: number
          source_question_id?: string | null
          subject?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mock_questions_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "mock_papers"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_rdm_bonus_attempts: {
        Row: {
          correct_count: number | null
          created_at: string
          denial_reason: string | null
          eligible: boolean
          id: string
          ist_claim_date: string
          paper_id: string
          rdm_awarded: number
          score_percent: number | null
          total_questions: number | null
          user_id: string
        }
        Insert: {
          correct_count?: number | null
          created_at?: string
          denial_reason?: string | null
          eligible?: boolean
          id?: string
          ist_claim_date: string
          paper_id: string
          rdm_awarded?: number
          score_percent?: number | null
          total_questions?: number | null
          user_id: string
        }
        Update: {
          correct_count?: number | null
          created_at?: string
          denial_reason?: string | null
          eligible?: boolean
          id?: string
          ist_claim_date?: string
          paper_id?: string
          rdm_awarded?: number
          score_percent?: number | null
          total_questions?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_rdm_bonus_attempts_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "mock_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_rdm_bonus_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_rdm_bonus_claims: {
        Row: {
          correct_count: number
          created_at: string
          id: string
          ist_claim_date: string
          paper_id: string
          rdm_amount: number
          score_percent: number
          total_questions: number
          user_id: string
        }
        Insert: {
          correct_count: number
          created_at?: string
          id?: string
          ist_claim_date: string
          paper_id: string
          rdm_amount?: number
          score_percent: number
          total_questions: number
          user_id: string
        }
        Update: {
          correct_count?: number
          created_at?: string
          id?: string
          ist_claim_date?: string
          paper_id?: string
          rdm_amount?: number
          score_percent?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_rdm_bonus_claims_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "mock_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_rdm_bonus_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_test_attempts: {
        Row: {
          attempt_key: string
          catalog_paper_id: string | null
          correct_count: number | null
          created_at: string
          duration_seconds: number | null
          id: string
          paper_slug: string | null
          paper_title: string
          past_paper_id: string | null
          score_percent: number | null
          session_kind: string
          subject_breakdown: Json
          total_questions: number | null
          user_id: string
        }
        Insert: {
          attempt_key: string
          catalog_paper_id?: string | null
          correct_count?: number | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          paper_slug?: string | null
          paper_title: string
          past_paper_id?: string | null
          score_percent?: number | null
          session_kind: string
          subject_breakdown?: Json
          total_questions?: number | null
          user_id: string
        }
        Update: {
          attempt_key?: string
          catalog_paper_id?: string | null
          correct_count?: number | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          paper_slug?: string | null
          paper_title?: string
          past_paper_id?: string | null
          score_percent?: number | null
          session_kind?: string
          subject_breakdown?: Json
          total_questions?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_test_attempts_catalog_paper_id_fkey"
            columns: ["catalog_paper_id"]
            isOneToOne: false
            referencedRelation: "mock_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_test_attempts_past_paper_id_fkey"
            columns: ["past_paper_id"]
            isOneToOne: false
            referencedRelation: "past_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_test_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_blog_posts: {
        Row: {
          author: string
          body: string
          content_format: string
          created_at: string
          exam: string
          exam_date: string
          featured: string
          hero_image_caption: string
          hero_image_url: string
          id: string
          inline_image_caption: string
          inline_image_url: string
          portal: string
          publish_date: string
          raw_html: string
          revision_plan: string
          role: string
          section: string
          source_link: string
          summary: string
          tags: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string
          body?: string
          content_format?: string
          created_at?: string
          exam: string
          exam_date?: string
          featured?: string
          hero_image_caption?: string
          hero_image_url?: string
          id: string
          inline_image_caption?: string
          inline_image_url?: string
          portal: string
          publish_date?: string
          raw_html?: string
          revision_plan?: string
          role?: string
          section: string
          source_link?: string
          summary: string
          tags?: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          body?: string
          content_format?: string
          created_at?: string
          exam?: string
          exam_date?: string
          featured?: string
          hero_image_caption?: string
          hero_image_url?: string
          id?: string
          inline_image_caption?: string
          inline_image_url?: string
          portal?: string
          publish_date?: string
          raw_html?: string
          revision_plan?: string
          role?: string
          section?: string
          source_link?: string
          summary?: string
          tags?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      numerals_community_share_rdm_claims: {
        Row: {
          claimed_at: string
          formula_index: number
          post_id: string
          rdm_amount: number
          subtopic_ref: string
          topic_ref: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          formula_index: number
          post_id: string
          rdm_amount: number
          subtopic_ref: string
          topic_ref: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          formula_index?: number
          post_id?: string
          rdm_amount?: number
          subtopic_ref?: string
          topic_ref?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "numerals_community_share_rdm_claims_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "lessons_raw_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "numerals_community_share_rdm_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      past_paper_questions: {
        Row: {
          chapter: string | null
          correct_letter: string
          difficulty: string | null
          id: string
          options_json: Json
          paper_id: string
          question_html: string
          solution_html: string | null
          sort_order: number
          source_question_id: string | null
          subject: string
          topic: string | null
        }
        Insert: {
          chapter?: string | null
          correct_letter: string
          difficulty?: string | null
          id?: string
          options_json: Json
          paper_id: string
          question_html: string
          solution_html?: string | null
          sort_order: number
          source_question_id?: string | null
          subject: string
          topic?: string | null
        }
        Update: {
          chapter?: string | null
          correct_letter?: string
          difficulty?: string | null
          id?: string
          options_json?: Json
          paper_id?: string
          question_html?: string
          solution_html?: string | null
          sort_order?: number
          source_question_id?: string | null
          subject?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "past_paper_questions_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "past_papers"
            referencedColumns: ["id"]
          },
        ]
      }
      past_papers: {
        Row: {
          class_level: number
          created_at: string
          duration_minutes: number
          exam_name: string | null
          exam_set_name: string | null
          id: string
          marking_scheme: string
          paper_type: string
          published: boolean
          question_count: number
          slug: string
          subjects_covered: string[]
          tags: string[]
          title: string
          total_marks: number
        }
        Insert: {
          class_level?: number
          created_at?: string
          duration_minutes?: number
          exam_name?: string | null
          exam_set_name?: string | null
          id?: string
          marking_scheme?: string
          paper_type?: string
          published?: boolean
          question_count?: number
          slug: string
          subjects_covered?: string[]
          tags?: string[]
          title: string
          total_marks?: number
        }
        Update: {
          class_level?: number
          created_at?: string
          duration_minutes?: number
          exam_name?: string | null
          exam_set_name?: string | null
          id?: string
          marking_scheme?: string
          paper_type?: string
          published?: boolean
          question_count?: number
          slug?: string
          subjects_covered?: string[]
          tags?: string[]
          title?: string
          total_marks?: number
        }
        Relationships: []
      }
      platform_feedback_submissions: {
        Row: {
          admin_note: string | null
          admin_status: string
          created_at: string
          extra_value: string | null
          features: Json
          id: string
          issue_category: string | null
          issue_text: string
          nps: number | null
          overall_rating: number
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          source: string
          specific_ratings: Json
          suggestion: string
          user_display_name: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          admin_status?: string
          created_at?: string
          extra_value?: string | null
          features?: Json
          id?: string
          issue_category?: string | null
          issue_text?: string
          nps?: number | null
          overall_rating: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          role: string
          source?: string
          specific_ratings?: Json
          suggestion?: string
          user_display_name?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          admin_status?: string
          created_at?: string
          extra_value?: string | null
          features?: Json
          id?: string
          issue_category?: string | null
          issue_text?: string
          nps?: number | null
          overall_rating?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          source?: string
          specific_ratings?: Json
          suggestion?: string
          user_display_name?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      play_history: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          pool_key: string | null
          question_id: string
          selected_answer_index: number | null
          time_taken_ms: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct: boolean
          pool_key?: string | null
          question_id: string
          selected_answer_index?: number | null
          time_taken_ms?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          pool_key?: string | null
          question_id?: string
          selected_answer_index?: number | null
          time_taken_ms?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_history_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "play_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "play_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      play_questions: {
        Row: {
          category: string
          content: Json
          correct_answer_index: number
          created_at: string
          difficulty_rating: number
          domain: string
          explanation: string | null
          id: string
          options: Json
        }
        Insert: {
          category: string
          content?: Json
          correct_answer_index: number
          created_at?: string
          difficulty_rating?: number
          domain: string
          explanation?: string | null
          id?: string
          options?: Json
        }
        Update: {
          category?: string
          content?: Json
          correct_answer_index?: number
          created_at?: string
          difficulty_rating?: number
          domain?: string
          explanation?: string | null
          id?: string
          options?: Json
        }
        Relationships: []
      }
      posts: {
        Row: {
          classroom_id: string
          content_json: Json | null
          created_at: string
          description: string | null
          due_date: string | null
          google_classroom_synced: boolean
          id: string
          section_id: string | null
          tags: string[] | null
          teacher_id: string
          title: string
          type: string
          updated_at: string
          visibility: string
        }
        Insert: {
          classroom_id: string
          content_json?: Json | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          google_classroom_synced?: boolean
          id?: string
          section_id?: string | null
          tags?: string[] | null
          teacher_id: string
          title: string
          type: string
          updated_at?: string
          visibility: string
        }
        Update: {
          classroom_id?: string
          content_json?: Json | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          google_classroom_synced?: boolean
          id?: string
          section_id?: string | null
          tags?: string[] | null
          teacher_id?: string
          title?: string
          type?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "classroom_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prep_calendar_day_activity: {
        Row: {
          class_count: number
          day: string
          doubt_count: number
          mock_count: number
          revision_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          class_count?: number
          day: string
          doubt_count?: number
          mock_count?: number
          revision_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          class_count?: number
          day?: string
          doubt_count?: number
          mock_count?: number
          revision_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_academics: {
        Row: {
          academic_year: string | null
          board: string
          created_at: string
          exam: string
          id: string
          marksheet_path: string | null
          record_status: string
          score: string
          updated_at: string
          user_id: string
          verified: string
        }
        Insert: {
          academic_year?: string | null
          board?: string
          created_at?: string
          exam: string
          id?: string
          marksheet_path?: string | null
          record_status?: string
          score?: string
          updated_at?: string
          user_id: string
          verified?: string
        }
        Update: {
          academic_year?: string | null
          board?: string
          created_at?: string
          exam?: string
          id?: string
          marksheet_path?: string | null
          record_status?: string
          score?: string
          updated_at?: string
          user_id?: string
          verified?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_academics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_achievements: {
        Row: {
          created_at: string
          id: string
          level: string
          marksheet_path: string | null
          name: string
          percentage: string
          result: string
          updated_at: string
          user_id: string
          verified: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          level: string
          marksheet_path?: string | null
          name: string
          percentage?: string
          result?: string
          updated_at?: string
          user_id: string
          verified?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          marksheet_path?: string | null
          name?: string
          percentage?: string
          result?: string
          updated_at?: string
          user_id?: string
          verified?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          academic_record_extras: Json
          avatar_url: string | null
          bio: string | null
          bits_test_attempts: Json
          board: string | null
          buddy_privacy_settings: Json
          card_added_at: string | null
          category: string | null
          city: string | null
          class_level: number | null
          created_at: string
          current_class_label: string | null
          daily_checklist_state: Json
          daily_dose_streak: number
          date_of_birth: string | null
          exam_tags: string[] | null
          first_name: string | null
          free_trial_activated: boolean
          free_trial_activated_at: string | null
          free_trial_checklist_reward_claimed_ever: boolean
          free_trial_daily_streak: Json
          gender: string | null
          google_connected: boolean
          id: string
          institution_name: string | null
          last_daily_dose_streak_date: string | null
          last_name: string | null
          lifetime_answer_rdm: number
          name: string
          onboarding_complete: boolean
          onboarding_reward_claimed_at: string | null
          onboarding_reward_progress: Json
          payment_card_details: Json | null
          phone: string | null
          plan_tier: string
          rdm: number
          role: string
          saved_bits: Json
          saved_community_posts: Json
          saved_formulas: Json
          saved_revision_cards: Json
          saved_revision_units: Json
          signup_google: boolean
          state: string | null
          stream: string | null
          subject_chat_regional_language: string | null
          subject_chat_regional_language_locked_at: string | null
          subject_combo: string | null
          subjects: string[] | null
          subscription_expires_at: string | null
          subscription_started_at: string | null
          subtopic_engagement: Json
          target_exam: string | null
          teacher_plan_expires_at: string | null
          teacher_plan_started_at: string | null
          teacher_plan_tier: string
          teaching_levels: number[] | null
          time_travel_enabled: boolean
          time_travel_offset_ms: number
          trial_end_bonus_activated: boolean | null
          trial_onboarding_answers: Json
          trial_original_ended_at: string | null
          trial_second_round_activated: boolean | null
          trial_streak_at_day_14: number | null
          updated_at: string
          visibility: string
          welcome_email_sent_at: string | null
        }
        Insert: {
          academic_record_extras?: Json
          avatar_url?: string | null
          bio?: string | null
          bits_test_attempts?: Json
          board?: string | null
          buddy_privacy_settings?: Json
          card_added_at?: string | null
          category?: string | null
          city?: string | null
          class_level?: number | null
          created_at?: string
          current_class_label?: string | null
          daily_checklist_state?: Json
          daily_dose_streak?: number
          date_of_birth?: string | null
          exam_tags?: string[] | null
          first_name?: string | null
          free_trial_activated?: boolean
          free_trial_activated_at?: string | null
          free_trial_checklist_reward_claimed_ever?: boolean
          free_trial_daily_streak?: Json
          gender?: string | null
          google_connected?: boolean
          id: string
          institution_name?: string | null
          last_daily_dose_streak_date?: string | null
          last_name?: string | null
          lifetime_answer_rdm?: number
          name: string
          onboarding_complete?: boolean
          onboarding_reward_claimed_at?: string | null
          onboarding_reward_progress?: Json
          payment_card_details?: Json | null
          phone?: string | null
          plan_tier?: string
          rdm?: number
          role?: string
          saved_bits?: Json
          saved_community_posts?: Json
          saved_formulas?: Json
          saved_revision_cards?: Json
          saved_revision_units?: Json
          signup_google?: boolean
          state?: string | null
          stream?: string | null
          subject_chat_regional_language?: string | null
          subject_chat_regional_language_locked_at?: string | null
          subject_combo?: string | null
          subjects?: string[] | null
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subtopic_engagement?: Json
          target_exam?: string | null
          teacher_plan_expires_at?: string | null
          teacher_plan_started_at?: string | null
          teacher_plan_tier?: string
          teaching_levels?: number[] | null
          time_travel_enabled?: boolean
          time_travel_offset_ms?: number
          trial_end_bonus_activated?: boolean | null
          trial_onboarding_answers?: Json
          trial_original_ended_at?: string | null
          trial_second_round_activated?: boolean | null
          trial_streak_at_day_14?: number | null
          updated_at?: string
          visibility?: string
          welcome_email_sent_at?: string | null
        }
        Update: {
          academic_record_extras?: Json
          avatar_url?: string | null
          bio?: string | null
          bits_test_attempts?: Json
          board?: string | null
          buddy_privacy_settings?: Json
          card_added_at?: string | null
          category?: string | null
          city?: string | null
          class_level?: number | null
          created_at?: string
          current_class_label?: string | null
          daily_checklist_state?: Json
          daily_dose_streak?: number
          date_of_birth?: string | null
          exam_tags?: string[] | null
          first_name?: string | null
          free_trial_activated?: boolean
          free_trial_activated_at?: string | null
          free_trial_checklist_reward_claimed_ever?: boolean
          free_trial_daily_streak?: Json
          gender?: string | null
          google_connected?: boolean
          id?: string
          institution_name?: string | null
          last_daily_dose_streak_date?: string | null
          last_name?: string | null
          lifetime_answer_rdm?: number
          name?: string
          onboarding_complete?: boolean
          onboarding_reward_claimed_at?: string | null
          onboarding_reward_progress?: Json
          payment_card_details?: Json | null
          phone?: string | null
          plan_tier?: string
          rdm?: number
          role?: string
          saved_bits?: Json
          saved_community_posts?: Json
          saved_formulas?: Json
          saved_revision_cards?: Json
          saved_revision_units?: Json
          signup_google?: boolean
          state?: string | null
          stream?: string | null
          subject_chat_regional_language?: string | null
          subject_chat_regional_language_locked_at?: string | null
          subject_combo?: string | null
          subjects?: string[] | null
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subtopic_engagement?: Json
          target_exam?: string | null
          teacher_plan_expires_at?: string | null
          teacher_plan_started_at?: string | null
          teacher_plan_tier?: string
          teaching_levels?: number[] | null
          time_travel_enabled?: boolean
          time_travel_offset_ms?: number
          trial_end_bonus_activated?: boolean | null
          trial_onboarding_answers?: Json
          trial_original_ended_at?: string | null
          trial_second_round_activated?: boolean | null
          trial_streak_at_day_14?: number | null
          updated_at?: string
          visibility?: string
          welcome_email_sent_at?: string | null
        }
        Relationships: []
      }
      quiz_community_share_rdm_claims: {
        Row: {
          claimed_at: string
          post_id: string
          quiz_set: number
          rdm_amount: number
          subtopic_ref: string
          topic_ref: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          post_id: string
          quiz_set: number
          rdm_amount: number
          subtopic_ref: string
          topic_ref: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          post_id?: string
          quiz_set?: number
          rdm_amount?: number
          subtopic_ref?: string
          topic_ref?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_community_share_rdm_claims_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "lessons_raw_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_community_share_rdm_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rdm_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: number
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: number
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      refer_challenge_claims: {
        Row: {
          challenge_key: string
          claim_date: string
          created_at: string
          share_claimed: boolean
          share_claimed_at: string | null
          updated_at: string
          user_id: string
          win_claimed: boolean
          win_claimed_at: string | null
        }
        Insert: {
          challenge_key: string
          claim_date: string
          created_at?: string
          share_claimed?: boolean
          share_claimed_at?: string | null
          updated_at?: string
          user_id: string
          win_claimed?: boolean
          win_claimed_at?: string | null
        }
        Update: {
          challenge_key?: string
          claim_date?: string
          created_at?: string
          share_claimed?: boolean
          share_claimed_at?: string | null
          updated_at?: string
          user_id?: string
          win_claimed?: boolean
          win_claimed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refer_challenge_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_attributions: {
        Row: {
          credited_at: string
          credited_week_start_ist: string
          id: string
          ref_code: string
          referee_rdm: number
          referee_user_id: string
          referrer_is_teacher: boolean
          referrer_rdm: number
          referrer_user_id: string
          teacher_paid_bonus_awarded_at: string | null
        }
        Insert: {
          credited_at?: string
          credited_week_start_ist: string
          id?: string
          ref_code: string
          referee_rdm?: number
          referee_user_id: string
          referrer_is_teacher?: boolean
          referrer_rdm?: number
          referrer_user_id: string
          teacher_paid_bonus_awarded_at?: string | null
        }
        Update: {
          credited_at?: string
          credited_week_start_ist?: string
          id?: string
          ref_code?: string
          referee_rdm?: number
          referee_user_id?: string
          referrer_is_teacher?: boolean
          referrer_rdm?: number
          referrer_user_id?: string
          teacher_paid_bonus_awarded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_attributions_referee_user_id_fkey"
            columns: ["referee_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_attributions_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_weekly_bonuses: {
        Row: {
          created_at: string
          id: string
          rdm_awarded: number
          referrer_user_id: string
          week_start_ist: string
        }
        Insert: {
          created_at?: string
          id?: string
          rdm_awarded?: number
          referrer_user_id: string
          week_start_ist: string
        }
        Update: {
          created_at?: string
          id?: string
          rdm_awarded?: number
          referrer_user_id?: string
          week_start_ist?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_weekly_bonuses_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_questions: {
        Row: {
          created_at: string
          id: string
          question_id: string
          source_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          source_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          source_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_questions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_bits_attempts: {
        Row: {
          attempt: Json
          attempt_key: string
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          attempt: Json
          attempt_key: string
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          attempt?: Json
          attempt_key?: string
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_bits_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_name: string
          id: string
          page: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_name: string
          id?: string
          page?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_name?: string
          id?: string
          page?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_gyan_presence: {
        Row: {
          updated_at: string
          user_id: string
        }
        Insert: {
          updated_at?: string
          user_id: string
        }
        Update: {
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_gyan_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_learning_dwell_2025_12: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2026_01: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2026_02: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2026_03: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2026_04: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2026_05: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2026_06: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2026_07: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2026_08: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2026_09: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2026_10: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2026_11: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2026_12: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2027_01: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2027_02: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2027_03: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2027_04: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2027_05: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_2027_06: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      student_learning_dwell_events: {
        Row: {
          bits_question_index: number | null
          board: string
          class_level: number
          client_session_id: string | null
          delta_ms: number
          id: string
          level: string
          occurred_at: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Insert: {
          bits_question_index?: number | null
          board: string
          class_level: number
          client_session_id?: string | null
          delta_ms: number
          id?: string
          level: string
          occurred_at?: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          user_id: string
        }
        Update: {
          bits_question_index?: number | null
          board?: string
          class_level?: number
          client_session_id?: string | null
          delta_ms?: number
          id?: string
          level?: string
          occurred_at?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_learning_dwell_events_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_learning_presence: {
        Row: {
          board: string
          class_level: number
          level: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          board: string
          class_level: number
          level: string
          panel: string
          subject: string
          subtopic_name: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          board?: string
          class_level?: number
          level?: string
          panel?: string
          subject?: string
          subtopic_name?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_learning_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_lesson_mark_completions: {
        Row: {
          board: string
          class_level: number
          level: string
          marked_complete_at: string
          subject: string
          subtopic: string
          topic: string
          user_id: string
        }
        Insert: {
          board: string
          class_level: number
          level: string
          marked_complete_at: string
          subject: string
          subtopic: string
          topic: string
          user_id: string
        }
        Update: {
          board?: string
          class_level?: number
          level?: string
          marked_complete_at?: string
          subject?: string
          subtopic?: string
          topic?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_lesson_mark_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_section_history: {
        Row: {
          classroom_id: string
          id: string
          joined_at: string
          left_at: string | null
          section_id: string | null
          user_id: string
        }
        Insert: {
          classroom_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          section_id?: string | null
          user_id: string
        }
        Update: {
          classroom_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          section_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_section_history_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_section_history_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "classroom_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_section_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_site_presence: {
        Row: {
          updated_at: string
          user_id: string
        }
        Insert: {
          updated_at?: string
          user_id: string
        }
        Update: {
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_site_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_subtopic_engagement: {
        Row: {
          snapshot: Json
          storage_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          snapshot: Json
          storage_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          snapshot?: Json
          storage_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subtopic_engagement_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_buddies: {
        Row: {
          buddy_user_id: string
          created_at: string
          ended_at: string | null
          id: string
          status: string
          user_id: string
        }
        Insert: {
          buddy_user_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          buddy_user_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_buddies_buddy_user_id_fkey"
            columns: ["buddy_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_buddies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_streak_milestone_claims: {
        Row: {
          claimed_at: string
          claimed_rdm: number
          milestone_days: number
          streak_start_date: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          claimed_rdm: number
          milestone_days: number
          streak_start_date: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          claimed_rdm?: number
          milestone_days?: number
          streak_start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_streak_milestone_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_topic_chat_messages: {
        Row: {
          content: string
          context_key: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          context_key: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          context_key?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_coupons: {
        Row: {
          code: string
          created_at: string
          duration_months: number
          id: string
          plan_tier: string
          redeemed_at: string | null
          redeemed_by_user_id: string | null
          restricted_to_user_ids: string[] | null
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          duration_months: number
          id?: string
          plan_tier: string
          redeemed_at?: string | null
          redeemed_by_user_id?: string | null
          restricted_to_user_ids?: string[] | null
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          duration_months?: number
          id?: string
          plan_tier?: string
          redeemed_at?: string | null
          redeemed_by_user_id?: string | null
          restricted_to_user_ids?: string[] | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_coupons_redeemed_by_user_id_fkey"
            columns: ["redeemed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subtopic_content: {
        Row: {
          bits_questions: Json
          board: string
          class_level: number
          created_at: string
          did_you_know: string
          display_title: string | null
          id: string
          instacue_cards: Json
          level: string
          practice_formulas: Json
          reading_references: Json
          subject: string
          subtopic_name: string
          theory: string
          topic: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bits_questions?: Json
          board: string
          class_level: number
          created_at?: string
          did_you_know?: string
          display_title?: string | null
          id?: string
          instacue_cards?: Json
          level: string
          practice_formulas?: Json
          reading_references?: Json
          subject: string
          subtopic_name: string
          theory?: string
          topic: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bits_questions?: Json
          board?: string
          class_level?: number
          created_at?: string
          did_you_know?: string
          display_title?: string | null
          id?: string
          instacue_cards?: Json
          level?: string
          practice_formulas?: Json
          reading_references?: Json
          subject?: string
          subtopic_name?: string
          theory?: string
          topic?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      teacher_generated_test_history: {
        Row: {
          board: string
          chapter_title: string | null
          class_level: number
          duration_minutes: number | null
          generated_at: string | null
          id: string
          question_count: number
          questions: Json
          scope: string
          subject: string
          teacher_id: string | null
          topic_title: string | null
          unit_title: string | null
          used_question_ids: Json | null
        }
        Insert: {
          board?: string
          chapter_title?: string | null
          class_level: number
          duration_minutes?: number | null
          generated_at?: string | null
          id?: string
          question_count?: number
          questions?: Json
          scope: string
          subject: string
          teacher_id?: string | null
          topic_title?: string | null
          unit_title?: string | null
          used_question_ids?: Json | null
        }
        Update: {
          board?: string
          chapter_title?: string | null
          class_level?: number
          duration_minutes?: number | null
          generated_at?: string | null
          id?: string
          question_count?: number
          questions?: Json
          scope?: string
          subject?: string
          teacher_id?: string | null
          topic_title?: string | null
          unit_title?: string | null
          used_question_ids?: Json | null
        }
        Relationships: []
      }
      teacher_google_calendar_tokens: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_google_calendar_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_live_class_rdm_grants: {
        Row: {
          awarded_at: string
          awarded_by: string
          base_rdm: number
          capped_student_count: number
          classroom_id: string
          id: string
          per_student_rdm: number
          session_id: string
          student_bonus_rdm: number
          student_count: number
          teacher_id: string
          total_rdm: number
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string
          base_rdm?: number
          capped_student_count?: number
          classroom_id: string
          id?: string
          per_student_rdm?: number
          session_id: string
          student_bonus_rdm?: number
          student_count?: number
          teacher_id: string
          total_rdm?: number
        }
        Update: {
          awarded_at?: string
          awarded_by?: string
          base_rdm?: number
          capped_student_count?: number
          classroom_id?: string
          id?: string
          per_student_rdm?: number
          session_id?: string
          student_bonus_rdm?: number
          student_count?: number
          teacher_id?: string
          total_rdm?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_live_class_rdm_grants_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_live_class_rdm_grants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_live_class_rdm_grants_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_motivation_rdm_grants: {
        Row: {
          amount: number
          assignment_post_id: string | null
          created_at: string
          id: string
          motivation_post_id: string
          paid_at: string | null
          status: string
          student_id: string
        }
        Insert: {
          amount: number
          assignment_post_id?: string | null
          created_at?: string
          id?: string
          motivation_post_id: string
          paid_at?: string | null
          status?: string
          student_id: string
        }
        Update: {
          amount?: number
          assignment_post_id?: string | null
          created_at?: string
          id?: string
          motivation_post_id?: string
          paid_at?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_motivation_rdm_grants_assignment_post_id_fkey"
            columns: ["assignment_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_motivation_rdm_grants_motivation_post_id_fkey"
            columns: ["motivation_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_motivation_rdm_grants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_profile_details: {
        Row: {
          aadhar_photo_url: string | null
          aadhar_share_link: string | null
          admin_notes: string | null
          approved_at: string | null
          contact_email_verified_at: string | null
          created_at: string
          email: string | null
          experience: string | null
          institute_certificate_photo_url: string | null
          institute_certificate_share_link: string | null
          location: string | null
          phone: string | null
          qualification: string | null
          rejected_at: string | null
          reviewed_at: string | null
          submitted_at: string | null
          teacher_id: string
          updated_at: string
          verification_status: string
          verified_contact_email: string | null
          youtube_or_social: string | null
        }
        Insert: {
          aadhar_photo_url?: string | null
          aadhar_share_link?: string | null
          admin_notes?: string | null
          approved_at?: string | null
          contact_email_verified_at?: string | null
          created_at?: string
          email?: string | null
          experience?: string | null
          institute_certificate_photo_url?: string | null
          institute_certificate_share_link?: string | null
          location?: string | null
          phone?: string | null
          qualification?: string | null
          rejected_at?: string | null
          reviewed_at?: string | null
          submitted_at?: string | null
          teacher_id: string
          updated_at?: string
          verification_status?: string
          verified_contact_email?: string | null
          youtube_or_social?: string | null
        }
        Update: {
          aadhar_photo_url?: string | null
          aadhar_share_link?: string | null
          admin_notes?: string | null
          approved_at?: string | null
          contact_email_verified_at?: string | null
          created_at?: string
          email?: string | null
          experience?: string | null
          institute_certificate_photo_url?: string | null
          institute_certificate_share_link?: string | null
          location?: string | null
          phone?: string | null
          qualification?: string | null
          rejected_at?: string | null
          reviewed_at?: string | null
          submitted_at?: string | null
          teacher_id?: string
          updated_at?: string
          verification_status?: string
          verified_contact_email?: string | null
          youtube_or_social?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_profile_details_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_section_schedule_rdm_grants: {
        Row: {
          awarded_at: string
          awarded_by: string
          base_rdm: number
          capped_student_count: number
          classroom_id: string
          id: string
          occurrence_at: string
          per_student_rdm: number
          quality_adjusted_x10: number | null
          quality_avg_x10: number | null
          quality_awarded_at: string | null
          quality_bonus_rdm: number | null
          quality_rating_count: number | null
          section_id: string
          student_bonus_rdm: number
          student_count: number
          teacher_id: string
          total_rdm: number
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string
          base_rdm?: number
          capped_student_count?: number
          classroom_id: string
          id?: string
          occurrence_at: string
          per_student_rdm?: number
          quality_adjusted_x10?: number | null
          quality_avg_x10?: number | null
          quality_awarded_at?: string | null
          quality_bonus_rdm?: number | null
          quality_rating_count?: number | null
          section_id: string
          student_bonus_rdm?: number
          student_count?: number
          teacher_id: string
          total_rdm?: number
        }
        Update: {
          awarded_at?: string
          awarded_by?: string
          base_rdm?: number
          capped_student_count?: number
          classroom_id?: string
          id?: string
          occurrence_at?: string
          per_student_rdm?: number
          quality_adjusted_x10?: number | null
          quality_avg_x10?: number | null
          quality_awarded_at?: string | null
          quality_bonus_rdm?: number | null
          quality_rating_count?: number | null
          section_id?: string
          student_bonus_rdm?: number
          student_count?: number
          teacher_id?: string
          total_rdm?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_section_schedule_rdm_grants_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_section_schedule_rdm_grants_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "classroom_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_section_schedule_rdm_grants_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_subscription_coupons: {
        Row: {
          code: string
          created_at: string
          duration_months: number
          id: string
          plan_tier: string
          redeemed_at: string | null
          redeemed_by_teacher_id: string | null
          restricted_to_teacher_ids: string[] | null
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          duration_months: number
          id?: string
          plan_tier: string
          redeemed_at?: string | null
          redeemed_by_teacher_id?: string | null
          restricted_to_teacher_ids?: string[] | null
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          duration_months?: number
          id?: string
          plan_tier?: string
          redeemed_at?: string | null
          redeemed_by_teacher_id?: string | null
          restricted_to_teacher_ids?: string[] | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_subscription_coupons_redeemed_by_teacher_id_fkey"
            columns: ["redeemed_by_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_content: {
        Row: {
          board: string
          class_level: number
          created_at: string
          hub_scope: string
          id: string
          level: string
          real_world: string
          subject: string
          subtopic_previews: Json
          topic: string
          updated_at: string
          updated_by: string | null
          what_learn: string
          why_study: string
        }
        Insert: {
          board: string
          class_level: number
          created_at?: string
          hub_scope?: string
          id?: string
          level: string
          real_world?: string
          subject: string
          subtopic_previews?: Json
          topic: string
          updated_at?: string
          updated_by?: string | null
          what_learn?: string
          why_study?: string
        }
        Update: {
          board?: string
          class_level?: number
          created_at?: string
          hub_scope?: string
          id?: string
          level?: string
          real_world?: string
          subject?: string
          subtopic_previews?: Json
          topic?: string
          updated_at?: string
          updated_by?: string | null
          what_learn?: string
          why_study?: string
        }
        Relationships: []
      }
      topic_content_runs: {
        Row: {
          board: string
          class_level: number
          created_at: string
          created_by: string | null
          disliked_points: string
          feedback_text: string
          hub_scope: string
          id: string
          instructions: string
          level: string
          liked_points: string
          model_id: string
          output_content: Json
          previous_content: Json
          rag_chunk_count: number
          run_type: string
          subject: string
          topic: string
        }
        Insert: {
          board: string
          class_level: number
          created_at?: string
          created_by?: string | null
          disliked_points?: string
          feedback_text?: string
          hub_scope?: string
          id?: string
          instructions?: string
          level: string
          liked_points?: string
          model_id?: string
          output_content?: Json
          previous_content?: Json
          rag_chunk_count?: number
          run_type: string
          subject: string
          topic: string
        }
        Update: {
          board?: string
          class_level?: number
          created_at?: string
          created_by?: string | null
          disliked_points?: string
          feedback_text?: string
          hub_scope?: string
          id?: string
          instructions?: string
          level?: string
          liked_points?: string
          model_id?: string
          output_content?: Json
          previous_content?: Json
          rag_chunk_count?: number
          run_type?: string
          subject?: string
          topic?: string
        }
        Relationships: []
      }
      topic_quiz_advanced_rdm_attempts: {
        Row: {
          board: string | null
          class_level: number | null
          correct_count: number | null
          created_at: string
          denial_reason: string | null
          eligible: boolean
          id: string
          ist_claim_date: string
          rdm_awarded: number
          score_percent: number | null
          subject: string | null
          subtopic_name: string | null
          topic: string | null
          total_questions: number | null
          user_id: string
        }
        Insert: {
          board?: string | null
          class_level?: number | null
          correct_count?: number | null
          created_at?: string
          denial_reason?: string | null
          eligible?: boolean
          id?: string
          ist_claim_date: string
          rdm_awarded?: number
          score_percent?: number | null
          subject?: string | null
          subtopic_name?: string | null
          topic?: string | null
          total_questions?: number | null
          user_id: string
        }
        Update: {
          board?: string | null
          class_level?: number | null
          correct_count?: number | null
          created_at?: string
          denial_reason?: string | null
          eligible?: boolean
          id?: string
          ist_claim_date?: string
          rdm_awarded?: number
          score_percent?: number | null
          subject?: string | null
          subtopic_name?: string | null
          topic?: string | null
          total_questions?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_quiz_advanced_rdm_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactional_email_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          ist_date: string
          kind: string
          message_id: string | null
          recipient: string
          status: string
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          ist_date: string
          kind: string
          message_id?: string | null
          recipient: string
          status: string
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          ist_date?: string
          kind?: string
          message_id?: string | null
          recipient?: string
          status?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_memory_profile: {
        Row: {
          canonical_profile: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          canonical_profile?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          canonical_profile?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_play_stats: {
        Row: {
          category: string
          current_rating: number
          question_pool_reset_at: string
          questions_answered: number
          updated_at: string
          user_id: string
          win_streak: number
        }
        Insert: {
          category: string
          current_rating?: number
          question_pool_reset_at?: string
          questions_answered?: number
          updated_at?: string
          user_id: string
          win_streak?: number
        }
        Update: {
          category?: string
          current_rating?: number
          question_pool_reset_at?: string
          questions_answered?: number
          updated_at?: string
          user_id?: string
          win_streak?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_play_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_saved_items: {
        Row: {
          content_id: string
          created_at: string
          data: Json
          id: string
          item_type: string
          review_at: string | null
          saved_at: string | null
          status: string | null
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          data?: Json
          id?: string
          item_type: string
          review_at?: string | null
          saved_at?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          data?: Json
          id?: string
          item_type?: string
          review_at?: string | null
          saved_at?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_saved_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_study_day_totals: {
        Row: {
          active_ms: number
          day: string
          presence_ms: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_ms?: number
          day: string
          presence_ms?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_ms?: number
          day?: string
          presence_ms?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_study_day_totals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_submissions: {
        Row: {
          admin_note: string | null
          admin_status: string
          ambassador_applied_at: string | null
          child_class: string | null
          child_exam: string | null
          city: string | null
          coaching: string | null
          consent_terms: boolean
          consent_updates: boolean
          created_at: string
          email: string
          exam: string | null
          experience: string | null
          first_name: string | null
          grade10_marks: string | null
          id: string
          interests: string[]
          last_name: string | null
          linkedin: string | null
          organisation: string | null
          organisation_role: string | null
          phone: string
          primary_subject: string | null
          refcode: string | null
          referral: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role: string | null
          school: string | null
          signup_tier: string
          state: string | null
          student_class: string | null
          students_count: string | null
          study_hours: string | null
          waitlist_id: string
          website: string | null
          why_join: string | null
        }
        Insert: {
          admin_note?: string | null
          admin_status?: string
          ambassador_applied_at?: string | null
          child_class?: string | null
          child_exam?: string | null
          city?: string | null
          coaching?: string | null
          consent_terms?: boolean
          consent_updates?: boolean
          created_at?: string
          email: string
          exam?: string | null
          experience?: string | null
          first_name?: string | null
          grade10_marks?: string | null
          id?: string
          interests?: string[]
          last_name?: string | null
          linkedin?: string | null
          organisation?: string | null
          organisation_role?: string | null
          phone: string
          primary_subject?: string | null
          refcode?: string | null
          referral?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string | null
          school?: string | null
          signup_tier?: string
          state?: string | null
          student_class?: string | null
          students_count?: string | null
          study_hours?: string | null
          waitlist_id: string
          website?: string | null
          why_join?: string | null
        }
        Update: {
          admin_note?: string | null
          admin_status?: string
          ambassador_applied_at?: string | null
          child_class?: string | null
          child_exam?: string | null
          city?: string | null
          coaching?: string | null
          consent_terms?: boolean
          consent_updates?: boolean
          created_at?: string
          email?: string
          exam?: string | null
          experience?: string | null
          first_name?: string | null
          grade10_marks?: string | null
          id?: string
          interests?: string[]
          last_name?: string | null
          linkedin?: string | null
          organisation?: string | null
          organisation_role?: string | null
          phone?: string
          primary_subject?: string | null
          refcode?: string | null
          referral?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string | null
          school?: string | null
          signup_tier?: string
          state?: string | null
          student_class?: string | null
          students_count?: string | null
          study_hours?: string | null
          waitlist_id?: string
          website?: string | null
          why_join?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      classroom_rating_summary: {
        Row: {
          avg_rating: number | null
          avg_video_rating: number | null
          avg_voice_rating: number | null
          classroom_id: string | null
          review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "classroom_reviews_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _bits_attempt_key: {
        Args: {
          p_board: string
          p_class_level: number
          p_set: number
          p_subject: string
          p_subtopic: string
          p_topic: string
        }
        Returns: string
      }
      _bits_sanitize_key_part: {
        Args: { maxlen: number; p: string }
        Returns: string
      }
      _formula_practice_attempt_key: {
        Args: {
          p_board: string
          p_class_level: number
          p_formula_idx: number
          p_level: string
          p_subject: string
          p_subtopic_name: string
          p_topic: string
        }
        Returns: string
      }
      _free_trial_daily_task_ids: { Args: never; Returns: string[] }
      _free_trial_daily_tasks_valid: {
        Args: { p_tasks: string[] }
        Returns: boolean
      }
      _free_trial_day2_unlock_at: {
        Args: { p_claimed_at: string }
        Returns: string
      }
      _free_trial_next_streak_day: { Args: { p_state: Json }; Returns: number }
      _free_trial_onboarding_all_complete: {
        Args: { p_progress: Json }
        Returns: boolean
      }
      _free_trial_onboarding_task_ids: { Args: never; Returns: string[] }
      _free_trial_streak_active_day: {
        Args: { p_state: Json }
        Returns: number
      }
      _free_trial_streak_day_task_ids: {
        Args: { p_day_key: string; p_state: Json }
        Returns: string[]
      }
      _free_trial_trial_day_number: {
        Args: { p_claimed_at: string; p_now?: string }
        Returns: number
      }
      _gyan_plus_onboarding_complete: {
        Args: { p_progress: Json }
        Returns: boolean
      }
      _js_int32_wrap: { Args: { x: number }; Returns: number }
      _legacy_sanitize_lookup: { Args: { t: string }; Returns: string }
      _norm_attempt_key_part: {
        Args: { max_len: number; t: string }
        Returns: string
      }
      _norm_content_key: { Args: { t: string }; Returns: string }
      _norm_subject_key: { Args: { t: string }; Returns: string }
      _parse_schedule_ymd: { Args: { p_raw: string }; Returns: string }
      _section_schedule_occurrence_start: {
        Args: { p_day: string; p_schedule_time: string; p_time_zone: string }
        Returns: string
      }
      _weekday_short_en: { Args: { p_d: string }; Returns: string }
      accept_buddy_invite:
        | { Args: { p_acceptor_id: string; p_token: string }; Returns: Json }
        | {
            Args: {
              p_acceptor_id: string
              p_acceptor_max?: number
              p_inviter_max?: number
              p_token: string
            }
            Returns: Json
          }
      accept_doubt_answer: {
        Args: { p_answer_id: string; p_bonus_rdm?: number; p_doubt_id: string }
        Returns: Json
      }
      add_rdm: { Args: { amt: number; uid: string }; Returns: number }
      add_user_site_presence_ms: {
        Args: { p_day: string; p_delta_ms: number }
        Returns: undefined
      }
      add_user_study_day_ms: {
        Args: { p_day: string; p_delta_ms: number }
        Returns: undefined
      }
      admin_analytics_summary: { Args: never; Returns: Json }
      admin_churn_risk: { Args: { p_limit?: number }; Returns: Json }
      admin_conversion_funnel: { Args: never; Returns: Json }
      admin_dropoff_tracking: { Args: never; Returns: Json }
      admin_event_funnel: {
        Args: { p_days?: number; p_event_names: string[] }
        Returns: Json
      }
      admin_event_summary: { Args: { p_days?: number }; Returns: Json }
      admin_feature_adoption: { Args: never; Returns: Json }
      admin_retention_cohorts: { Args: never; Returns: Json }
      archive_expired_classroom_sections: { Args: never; Returns: number }
      award_classroom_batch_paid_bonus: {
        Args: { p_user_id: string }
        Returns: Json
      }
      award_daily_rdm: {
        Args: { p_action_type: string; p_points: number; p_user_id: string }
        Returns: Json
      }
      award_eligible_section_schedule_delivery_rdm: {
        Args: { p_teacher_id: string }
        Returns: Json
      }
      award_eligible_teacher_live_class_delivery_rdm: {
        Args: { p_teacher_id: string }
        Returns: Json
      }
      award_eligible_teacher_live_class_quality_rdm: {
        Args: { p_teacher_id: string }
        Returns: Json
      }
      award_teacher_live_class_delivery_rdm: {
        Args: {
          p_awarded_by?: string
          p_force_before_end?: boolean
          p_session_id: string
        }
        Returns: Json
      }
      award_teacher_referral_paid_bonus: {
        Args: { p_referee_id: string }
        Returns: Json
      }
      award_teacher_section_schedule_occurrence_rdm: {
        Args: {
          p_awarded_by?: string
          p_force_before_end?: boolean
          p_occurrence_at: string
          p_section_id: string
        }
        Returns: Json
      }
      award_teacher_section_schedule_quality_rdm: {
        Args: { p_occurrence_at: string; p_section_id: string }
        Returns: Json
      }
      bits_signature_v1: { Args: { bits_questions: Json }; Returns: string }
      claim_cbse_mcq_chapter_score_rdm: {
        Args: {
          p_attempt_key: string
          p_correct: number
          p_paper_id: string
          p_total: number
        }
        Returns: Json
      }
      claim_cbse_mcq_community_share_rdm: {
        Args: { p_post_id: string }
        Returns: Json
      }
      claim_free_trial_checklist_reward: { Args: never; Returns: Json }
      claim_free_trial_daily_streak_reward: {
        Args: { p_day: number; p_task_ids?: string[] }
        Returns: Json
      }
      claim_instacue_create_daily_rdm: { Args: never; Returns: Json }
      claim_mock_community_share_rdm: {
        Args: { p_post_id: string }
        Returns: Json
      }
      claim_mock_rdm_bonus: {
        Args: { p_answer_indices: number[]; p_paper_id: string }
        Returns: Json
      }
      claim_numerals_community_share_rdm: {
        Args: { p_post_id: string }
        Returns: Json
      }
      claim_numerals_pack_complete_daily_rdm: {
        Args: {
          p_board: string
          p_class_level: number
          p_level: string
          p_subject: string
          p_subtopic_name: string
          p_topic: string
        }
        Returns: Json
      }
      claim_quiz_community_share_rdm: {
        Args: { p_post_id: string }
        Returns: Json
      }
      claim_refer_challenge_reward: {
        Args: {
          p_challenge_key: string
          p_claim_date?: string
          p_reward_type: string
        }
        Returns: Json
      }
      claim_referral_attribution: {
        Args: { p_ref_code: string; p_referee_id: string }
        Returns: Json
      }
      claim_topic_quiz_advanced_daily_rdm: {
        Args: {
          p_board: string
          p_class_level: number
          p_subject: string
          p_subtopic_name: string
          p_topic: string
        }
        Returns: Json
      }
      create_classroom_bulk_invite: {
        Args: { p_classroom_id: string; p_emails: string[] }
        Returns: Json
      }
      create_doubt_with_escrow: {
        Args: {
          p_body: string
          p_bounty_rdm?: number
          p_cost_rdm?: number
          p_subject: string
          p_title: string
        }
        Returns: Json
      }
      deduct_rdm: { Args: { amt: number; uid: string }; Returns: number }
      end_buddy_pair:
        | { Args: { p_user_id: string }; Returns: Json }
        | {
            Args: { p_buddy_user_id?: string; p_user_id: string }
            Returns: Json
          }
      ensure_dwell_events_partition: {
        Args: { p_month?: string }
        Returns: string
      }
      find_similar_answered_doubt: {
        Args: { p_min_similarity?: number; p_title: string }
        Returns: {
          answer_body: string
          similarity_score: number
          source_doubt_id: string
        }[]
      }
      get_adaptive_play_questions: {
        Args: { p_category: string; p_count?: number; p_domain: string }
        Returns: {
          category: string
          content: Json
          correct_answer_index: number
          difficulty_rating: number
          explanation: string
          id: string
          options: Json
        }[]
      }
      get_daily_gauntlet_leaderboard:
        | {
            Args: { p_gauntlet_date: string }
            Returns: {
              completed_at: string
              correct_count: number
              display_name: string
              rank: number
              total_time_ms: number
              user_id: string
            }[]
          }
        | {
            Args: { p_domain?: string; p_gauntlet_date: string }
            Returns: {
              completed_at: string
              correct_count: number
              display_name: string
              rank: number
              total_time_ms: number
              user_id: string
            }[]
          }
      get_daily_gauntlet_questions:
        | {
            Args: { p_date: string }
            Returns: {
              content: Json
              correct_answer_index: number
              difficulty_rating: number
              explanation: string
              id: string
              options: Json
            }[]
          }
        | {
            Args: { p_date: string; p_domain?: string }
            Returns: {
              category: string
              content: Json
              correct_answer_index: number
              difficulty_rating: number
              explanation: string
              id: string
              options: Json
            }[]
          }
      get_daily_rdm_earned_ist: { Args: never; Returns: number }
      get_pending_live_class_rating: { Args: never; Returns: Json }
      get_prep_calendar_summary: { Args: { p_today: string }; Returns: Json }
      get_refer_challenge_day_status: {
        Args: { p_claim_date?: string }
        Returns: Json
      }
      get_study_streak_summary: { Args: { p_today: string }; Returns: Json }
      get_user_mock_subject_score_averages: {
        Args: never
        Returns: {
          avg_pct: number
          paper_count: number
          subject: string
        }[]
      }
      get_user_saved_item_counts: {
        Args: { p_user_id: string }
        Returns: {
          cnt: number
          item_type: string
        }[]
      }
      increment_doubt_views: {
        Args: { p_doubt_id: string }
        Returns: undefined
      }
      increment_prep_calendar_day: {
        Args: { p_day: string; p_field: string }
        Returns: undefined
      }
      is_gyan_bot_user: { Args: { p_user_id: string }; Returns: boolean }
      is_owner_prefixed_storage_path: {
        Args: { path: string }
        Returns: boolean
      }
      link_my_classroom_invites: { Args: never; Returns: Json }
      lookup_classroom_by_join_code: { Args: { p_code: string }; Returns: Json }
      match_episodic_memory: {
        Args: {
          match_count: number
          match_threshold: number
          p_user_id: string
          query_embedding: string
        }
        Returns: {
          chunk_text: string
          id: string
          similarity: number
        }[]
      }
      match_episodic_memory_scoped: {
        Args: {
          match_count: number
          match_threshold: number
          p_context_key: string
          p_user_id: string
          query_embedding: string
        }
        Returns: {
          chunk_text: string
          id: string
          similarity: number
        }[]
      }
      profiles_rdm_mutation_allowed: { Args: never; Returns: boolean }
      prune_empty_dwell_partitions: {
        Args: { p_months_ahead?: number; p_months_behind?: number }
        Returns: Json
      }
      prune_telemetry_logs: {
        Args: { p_ai_token_days?: number; p_dwell_days?: number }
        Returns: Json
      }
      reconcile_inactive_day_penalties: { Args: never; Returns: Json }
      record_mock_test_attempt: {
        Args: {
          p_attempt_key: string
          p_catalog_paper_id: string
          p_correct_count: number
          p_duration_seconds: number
          p_paper_slug: string
          p_paper_title: string
          p_past_paper_id: string
          p_score_percent: number
          p_session_kind: string
          p_subject_breakdown: Json
          p_total_questions: number
        }
        Returns: Json
      }
      record_play_result: {
        Args: {
          p_category?: string
          p_is_correct: boolean
          p_pool_key?: string
          p_question_id: string
          p_selected_answer_index?: number
          p_time_taken_ms?: number
        }
        Returns: undefined
      }
      refund_expired_doubt_bounties: { Args: never; Returns: number }
      reset_free_trial_daily_streak_day: {
        Args: { p_day: number }
        Returns: Json
      }
      resolve_subscription_plan_key: {
        Args: { p_user_id: string }
        Returns: string
      }
      search_doubt_duplicates: {
        Args: { p_title: string }
        Returns: {
          id: string
          similarity_score: number
          title: string
        }[]
      }
      set_subject_chat_regional_language: {
        Args: { p_language: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      student_can_read_post_via_teacher_nudge: {
        Args: { p_classroom_id: string; p_post_id: string }
        Returns: boolean
      }
      student_has_active_grant_for_assignment: {
        Args: { p_post_id: string }
        Returns: boolean
      }
      submit_daily_gauntlet:
        | { Args: { p_gauntlet_date: string; p_results: Json }; Returns: Json }
        | {
            Args: {
              p_domain?: string
              p_gauntlet_date: string
              p_results: Json
            }
            Returns: Json
          }
      submit_live_class_rating: {
        Args: { p_occurrence_at: string; p_section_id: string; p_stars: number }
        Returns: Json
      }
      sync_free_trial_daily_streak_task: {
        Args: { p_day: number; p_task_id: string }
        Returns: Json
      }
      teacher_owns_motivation_post: {
        Args: { p_motivation_post_id: string }
        Returns: boolean
      }
      toggle_lessons_raw_post_boost: {
        Args: { p_post_id: string }
        Returns: {
          boost_count: number
          boosted: boolean
        }[]
      }
      user_is_member_of_classroom: {
        Args: { cid: string; uid: string }
        Returns: boolean
      }
      vote_lessons_raw_post: {
        Args: { p_click: number; p_post_id: string }
        Returns: {
          down_count: number
          my_vote: number
          score: number
          up_count: number
        }[]
      }
      vote_on_doubt: {
        Args: {
          p_target_id: string
          p_target_type: string
          p_vote_type: number
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "teacher", "student"],
    },
  },
} as const
