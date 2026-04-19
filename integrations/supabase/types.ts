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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accepted_answer_payouts: {
        Row: {
          id: string
          user_id: string
          answer_id: string
          rdm_paid: number
          paid_at: string
        }
        Insert: {
          id?: string
          user_id: string
          answer_id: string
          rdm_paid: number
          paid_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          answer_id?: string
          rdm_paid?: number
          paid_at?: string
        }
        Relationships: [
          { foreignKeyName: "accepted_answer_payouts_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "accepted_answer_payouts_answer_id_fkey"; columns: ["answer_id"]; isOneToOne: false; referencedRelation: "doubt_answers"; referencedColumns: ["id"] },
        ]
      }
      ai_token_logs: {
        Row: {
          id: string
          created_at: string
          user_id: string | null
          action_type: string
          model_id: string
          backend: string
          prompt_tokens: number
          candidates_tokens: number
          total_tokens: number
          cost_usd: number
          metadata: Json
        }
        Insert: {
          id?: string
          created_at?: string
          user_id?: string | null
          action_type: string
          model_id?: string
          backend?: string
          prompt_tokens?: number
          candidates_tokens?: number
          total_tokens?: number
          cost_usd?: number
          metadata?: Json
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string | null
          action_type?: string
          model_id?: string
          backend?: string
          prompt_tokens?: number
          candidates_tokens?: number
          total_tokens?: number
          cost_usd?: number
          metadata?: Json
        }
        Relationships: []
      }
      curriculum_units: {
        Row: {
          id: string
          subject: string
          class_level: number
          unit_label: string
          unit_title: string
          exam_relevance: string[] | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          subject: string
          class_level: number
          unit_label: string
          unit_title: string
          exam_relevance?: string[] | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          subject?: string
          class_level?: number
          unit_label?: string
          unit_title?: string
          exam_relevance?: string[] | null
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      curriculum_chapters: {
        Row: {
          id: string
          unit_id: string
          title: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          unit_id: string
          title: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          unit_id?: string
          title?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [{ foreignKeyName: "curriculum_chapters_unit_id_fkey"; columns: ["unit_id"]; isOneToOne: false; referencedRelation: "curriculum_units"; referencedColumns: ["id"] }]
      }
      curriculum_topics: {
        Row: {
          id: string
          chapter_id: string
          title: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          chapter_id: string
          title: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          chapter_id?: string
          title?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [{ foreignKeyName: "curriculum_topics_chapter_id_fkey"; columns: ["chapter_id"]; isOneToOne: false; referencedRelation: "curriculum_chapters"; referencedColumns: ["id"] }]
      }
      curriculum_subtopics: {
        Row: {
          id: string
          topic_id: string
          name: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          topic_id: string
          name: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          topic_id?: string
          name?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [{ foreignKeyName: "curriculum_subtopics_topic_id_fkey"; columns: ["topic_id"]; isOneToOne: false; referencedRelation: "curriculum_topics"; referencedColumns: ["id"] }]
      }
      classroom_members: {
        Row: {
          classroom_id: string
          google_synced: boolean
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          classroom_id: string
          google_synced?: boolean
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          classroom_id?: string
          google_synced?: boolean
          id?: string
          joined_at?: string
          role?: string
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
            foreignKeyName: "classroom_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_join_requests: {
        Row: {
          id: string
          classroom_id: string
          user_id: string
          status: string
          created_at: string
          responded_at: string | null
          responded_by: string | null
        }
        Insert: {
          id?: string
          classroom_id: string
          user_id: string
          status?: string
          created_at?: string
          responded_at?: string | null
          responded_by?: string | null
        }
        Update: {
          id?: string
          classroom_id?: string
          user_id?: string
          status?: string
          created_at?: string
          responded_at?: string | null
          responded_by?: string | null
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
            foreignKeyName: "classroom_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_join_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classrooms: {
        Row: {
          created_at: string
          description: string | null
          google_classroom_id: string | null
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
          created_at?: string
          description?: string | null
          google_classroom_id?: string | null
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
          created_at?: string
          description?: string | null
          google_classroom_id?: string | null
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
      lessons_raw_post_boosts: {
        Row: {
          id: string
          post_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          created_at?: string
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
          id: string
          post_id: string
          user_id: string
          parent_id: string | null
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          parent_id?: string | null
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          parent_id?: string | null
          body?: string
          created_at?: string
        }
        Relationships: [
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
          post_id: string
          user_id: string
          vote: number
          created_at: string
        }
        Insert: {
          post_id: string
          user_id: string
          vote: number
          created_at?: string
        }
        Update: {
          post_id?: string
          user_id?: string
          vote?: number
          created_at?: string
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
          id: string
          user_id: string
          kind: string
          title: string
          content: string
          tags: string[]
          subject: string | null
          chapter_ref: string | null
          board_ref: string | null
          grade_ref: string | null
          unit_ref: string | null
          topic_ref: string | null
          subtopic_ref: string | null
          source_type: string | null
          source_payload: Json | null
          boost_count: number
          upvote_count: number
          downvote_count: number
          comment_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          kind: string
          title: string
          content: string
          tags?: string[]
          subject?: string | null
          chapter_ref?: string | null
          board_ref?: string | null
          grade_ref?: string | null
          unit_ref?: string | null
          topic_ref?: string | null
          subtopic_ref?: string | null
          source_type?: string | null
          source_payload?: Json | null
          boost_count?: number
          upvote_count?: number
          downvote_count?: number
          comment_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          kind?: string
          title?: string
          content?: string
          tags?: string[]
          subject?: string | null
          chapter_ref?: string | null
          board_ref?: string | null
          grade_ref?: string | null
          unit_ref?: string | null
          topic_ref?: string | null
          subtopic_ref?: string | null
          source_type?: string | null
          source_payload?: Json | null
          boost_count?: number
          upvote_count?: number
          downvote_count?: number
          comment_count?: number
          created_at?: string
          updated_at?: string
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
      live_sessions: {
        Row: {
          attendance_code: string | null
          classroom_id: string
          created_at: string
          duration_minutes: number
          id: string
          meet_link: string | null
          recap_post_id: string | null
          recording_url: string | null
          scheduled_at: string
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
          recap_post_id?: string | null
          recording_url?: string | null
          scheduled_at: string
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
          recap_post_id?: string | null
          recording_url?: string | null
          scheduled_at?: string
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
            foreignKeyName: "live_sessions_recap_post_id_fkey"
            columns: ["recap_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
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
      live_session_joins: {
        Row: {
          id: string
          session_id: string
          user_id: string
          credits_deducted: number
          joined_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          credits_deducted?: number
          joined_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          credits_deducted?: number
          joined_at?: string
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
      class_exploration_sessions: {
        Row: {
          id: string
          user_id: string
          classroom_id: string
          started_at: string
        }
        Insert: {
          id?: string
          user_id: string
          classroom_id: string
          started_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          classroom_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_exploration_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_exploration_sessions_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      episodic_memory: {
        Row: {
          id: string
          user_id: string
          chunk_text: string
          embedding: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          chunk_text: string
          embedding: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          chunk_text?: string
          embedding?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "episodic_memory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      explorer_live_joins: {
        Row: {
          id: string
          user_id: string
          session_id: string
          joined_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_id: string
          joined_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_id?: string
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "explorer_live_joins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "explorer_live_joins_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prep_calendar_day_activity: {
        Row: {
          user_id: string
          day: string
          class_count: number
          revision_count: number
          mock_count: number
          doubt_count: number
          updated_at: string
        }
        Insert: {
          user_id: string
          day: string
          class_count?: number
          revision_count?: number
          mock_count?: number
          doubt_count?: number
          updated_at?: string
        }
        Update: {
          user_id?: string
          day?: string
          class_count?: number
          revision_count?: number
          mock_count?: number
          doubt_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prep_calendar_day_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          tags?: string[] | null
          teacher_id: string
          title: string
          type?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          classroom_id?: string
          content_json?: Json | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          google_classroom_synced?: boolean
          id?: string
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
            foreignKeyName: "posts_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          bits_test_attempts: Json
          subtopic_engagement: Json
          daily_checklist_state: Json
          class_level: number | null
          created_at: string
          exam_tags: string[] | null
          target_exam: string | null
          google_connected: boolean
          id: string
          lifetime_answer_rdm: number
          name: string
          onboarding_complete: boolean
          rdm: number
          role: string
          saved_bits: Json
          saved_community_posts: Json
          saved_formulas: Json
          saved_revision_cards: Json
          saved_revision_units: Json
          stream: string | null
          subject_combo: string | null
          subjects: string[] | null
          teaching_levels: number[] | null
          updated_at: string
          visibility: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          bits_test_attempts?: Json
          subtopic_engagement?: Json
          daily_checklist_state?: Json
          class_level?: number | null
          created_at?: string
          exam_tags?: string[] | null
          target_exam?: string | null
          google_connected?: boolean
          id: string
          lifetime_answer_rdm?: number
          name?: string
          onboarding_complete?: boolean
          rdm?: number
          role?: string
          saved_bits?: Json
          saved_community_posts?: Json
          saved_formulas?: Json
          saved_revision_cards?: Json
          saved_revision_units?: Json
          stream?: string | null
          subject_combo?: string | null
          subjects?: string[] | null
          teaching_levels?: number[] | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          bits_test_attempts?: Json
          subtopic_engagement?: Json
          daily_checklist_state?: Json
          class_level?: number | null
          created_at?: string
          exam_tags?: string[] | null
          target_exam?: string | null
          google_connected?: boolean
          id?: string
          lifetime_answer_rdm?: number
          name?: string
          onboarding_complete?: boolean
          rdm?: number
          role?: string
          saved_bits?: Json
          saved_community_posts?: Json
          saved_formulas?: Json
          saved_revision_cards?: Json
          saved_revision_units?: Json
          stream?: string | null
          subject_combo?: string | null
          subjects?: string[] | null
          teaching_levels?: number[] | null
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      subject_topic_chat_messages: {
        Row: {
          id: string
          user_id: string
          context_key: string
          role: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          context_key: string
          role: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          context_key?: string
          role?: string
          content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_topic_chat_messages_user_id_fkey"
            columns: ["user_id"]
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
      topic_content: {
        Row: {
          board: string
          class_level: number
          created_at: string
          id: string
          level: string
          real_world: string
          subject: string
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
          id?: string
          level: string
          real_world?: string
          subject: string
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
          id?: string
          level?: string
          real_world?: string
          subject?: string
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
      session_attendance: {
        Row: {
          checked_in_at: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          checked_in_at?: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          checked_in_at?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doubt_answer_reports: {
        Row: {
          id: string
          answer_id: string
          reporter_user_id: string
          reason: string
          created_at: string
        }
        Insert: {
          id?: string
          answer_id: string
          reporter_user_id: string
          reason?: string
          created_at?: string
        }
        Update: {
          id?: string
          answer_id?: string
          reporter_user_id?: string
          reason?: string
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "doubt_answer_reports_answer_id_fkey"; columns: ["answer_id"]; isOneToOne: false; referencedRelation: "doubt_answers"; referencedColumns: ["id"] },
          { foreignKeyName: "doubt_answer_reports_reporter_user_id_fkey"; columns: ["reporter_user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      doubt_answers: {
        Row: {
          id: string
          doubt_id: string
          user_id: string
          body: string
          upvotes: number
          downvotes: number
          is_accepted: boolean
          hidden: boolean
          created_at: string
        }
        Insert: {
          id?: string
          doubt_id: string
          user_id: string
          body?: string
          upvotes?: number
          downvotes?: number
          is_accepted?: boolean
          hidden?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          doubt_id?: string
          user_id?: string
          body?: string
          upvotes?: number
          downvotes?: number
          is_accepted?: boolean
          hidden?: boolean
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "doubt_answers_doubt_id_fkey"; columns: ["doubt_id"]; isOneToOne: false; referencedRelation: "doubts"; referencedColumns: ["id"] },
          { foreignKeyName: "doubt_answers_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      doubt_saves: {
        Row: {
          user_id: string
          doubt_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          doubt_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          doubt_id?: string
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "doubt_saves_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "doubt_saves_doubt_id_fkey"; columns: ["doubt_id"]; isOneToOne: false; referencedRelation: "doubts"; referencedColumns: ["id"] },
        ]
      }
      doubts: {
        Row: {
          id: string
          user_id: string
          title: string
          body: string
          subject: string | null
          upvotes: number
          downvotes: number
          is_resolved: boolean
          bounty_rdm: number
          cost_rdm: number
          bounty_escrowed_at: string | null
          views: number
          created_at: string
          gyan_curriculum_node_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          body?: string
          subject?: string | null
          upvotes?: number
          downvotes?: number
          is_resolved?: boolean
          bounty_rdm?: number
          cost_rdm?: number
          bounty_escrowed_at?: string | null
          views?: number
          created_at?: string
          gyan_curriculum_node_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          body?: string
          subject?: string | null
          upvotes?: number
          downvotes?: number
          is_resolved?: boolean
          bounty_rdm?: number
          cost_rdm?: number
          bounty_escrowed_at?: string | null
          views?: number
          created_at?: string
          gyan_curriculum_node_id?: string | null
        }
        Relationships: [
          { foreignKeyName: "doubts_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          {
            foreignKeyName: "doubts_gyan_curriculum_node_id_fkey";
            columns: ["gyan_curriculum_node_id"];
            isOneToOne: false;
            referencedRelation: "gyan_curriculum_nodes";
            referencedColumns: ["id"];
          },
        ]
      }
      doubt_votes: {
        Row: {
          id: string
          user_id: string
          target_type: string
          target_id: string
          vote_type: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          target_type: string
          target_id: string
          vote_type: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          target_type?: string
          target_id?: string
          vote_type?: number
          created_at?: string
        }
        Relationships: [{ foreignKeyName: "doubt_votes_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }]
      }
      gyan_bot_config: {
        Row: {
          id: number
          active: boolean
          interval_minutes: number
          current_student_index: number
          last_post_at: string | null
          updated_at: string
          curriculum_sequence_index: number
          curriculum_batch_slot: number
        }
        Insert: {
          id?: number
          active?: boolean
          interval_minutes?: number
          current_student_index?: number
          last_post_at?: string | null
          updated_at?: string
          curriculum_sequence_index?: number
          curriculum_batch_slot?: number
        }
        Update: {
          id?: number
          active?: boolean
          interval_minutes?: number
          current_student_index?: number
          last_post_at?: string | null
          updated_at?: string
          curriculum_sequence_index?: number
          curriculum_batch_slot?: number
        }
        Relationships: []
      }
      gyan_curriculum_nodes: {
        Row: {
          id: string
          subject: string
          class_level: number
          sort_order: number
          chapter_key: string
          chapter_label: string
          topic_key: string
          topic_label: string
          subtopic_key: string | null
          subtopic_label: string | null
          rag_query_hint: string
          created_at: string
        }
        Insert: {
          id?: string
          subject: string
          class_level: number
          sort_order: number
          chapter_key: string
          chapter_label: string
          topic_key: string
          topic_label: string
          subtopic_key?: string | null
          subtopic_label?: string | null
          rag_query_hint: string
          created_at?: string
        }
        Update: {
          id?: string
          subject?: string
          class_level?: number
          sort_order?: number
          chapter_key?: string
          chapter_label?: string
          topic_key?: string
          topic_label?: string
          subtopic_key?: string | null
          subtopic_label?: string | null
          rag_query_hint?: string
          created_at?: string
        }
        Relationships: []
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
      play_questions: {
        Row: {
          id: string
          domain: string
          category: string
          difficulty_rating: number
          content: Json
          options: Json
          correct_answer_index: number
          explanation: string | null
          created_at: string
        }
        Insert: {
          id?: string
          domain: string
          category: string
          difficulty_rating?: number
          content?: Json
          options?: Json
          correct_answer_index: number
          explanation?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          domain?: string
          category?: string
          difficulty_rating?: number
          content?: Json
          options?: Json
          correct_answer_index?: number
          explanation?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_play_stats: {
        Row: {
          user_id: string
          category: string
          current_rating: number
          questions_answered: number
          win_streak: number
          updated_at: string
          question_pool_reset_at: string
        }
        Insert: {
          user_id: string
          category: string
          current_rating?: number
          questions_answered?: number
          win_streak?: number
          updated_at?: string
          question_pool_reset_at?: string
        }
        Update: {
          user_id?: string
          category?: string
          current_rating?: number
          questions_answered?: number
          win_streak?: number
          updated_at?: string
          question_pool_reset_at?: string
        }
        Relationships: [{ foreignKeyName: "user_play_stats_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }]
      }
      play_history: {
        Row: {
          id: string
          user_id: string
          question_id: string
          is_correct: boolean
          time_taken_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          question_id: string
          is_correct: boolean
          time_taken_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          question_id?: string
          is_correct?: boolean
          time_taken_ms?: number | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "play_history_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "play_history_question_id_fkey"; columns: ["question_id"]; isOneToOne: false; referencedRelation: "play_questions"; referencedColumns: ["id"] },
        ]
      }
      daily_gauntlet_attempts: {
        Row: {
          id: string
          user_id: string
          gauntlet_date: string
          total_time_ms: number
          correct_count: number
          completed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          gauntlet_date: string
          total_time_ms: number
          correct_count: number
          completed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          gauntlet_date?: string
          total_time_ms?: number
          correct_count?: number
          completed_at?: string
        }
        Relationships: [{ foreignKeyName: "daily_gauntlet_attempts_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }]
      }
      profile_academics: {
        Row: {
          id: string
          user_id: string
          exam: string
          board: string
          score: string
          verified: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          exam: string
          board?: string
          score?: string
          verified?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          exam?: string
          board?: string
          score?: string
          verified?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [{ foreignKeyName: "profile_academics_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }]
      }
      profile_achievements: {
        Row: {
          id: string
          user_id: string
          name: string
          level: string
          year: number
          result: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          level: string
          year: number
          result?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          level?: string
          year?: number
          result?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [{ foreignKeyName: "profile_achievements_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }]
      }
      user_memory_profile: {
        Row: {
          user_id: string
          canonical_profile: Json
          updated_at: string
        }
        Insert: {
          user_id: string
          canonical_profile?: Json
          updated_at?: string
        }
        Update: {
          user_id?: string
          canonical_profile?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_memory_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_doubt_answer: {
        Args: { p_doubt_id: string; p_answer_id: string; p_bonus_rdm?: number }
        Returns: Json
      }
      create_doubt_with_escrow: {
        Args: { p_title: string; p_body: string; p_subject: string; p_cost_rdm?: number; p_bounty_rdm?: number }
        Returns: Json
      }
      add_rdm: {
        Args: { uid: string; amt: number }
        Returns: number | null
      }
      deduct_rdm: {
        Args: { uid: string; amt: number }
        Returns: number | null
      }
      refund_expired_doubt_bounties: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      search_doubt_duplicates: {
        Args: { p_title: string }
        Returns: { id: string; title: string; similarity_score: number }[]
      }
      find_similar_answered_doubt: {
        Args: { p_title: string; p_min_similarity?: number }
        Returns: { source_doubt_id: string; answer_body: string; similarity_score: number }[]
      }
      increment_doubt_views: {
        Args: { p_doubt_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_classroom_member: {
        Args: { _classroom_id: string; _user_id: string }
        Returns: boolean
      }
      match_episodic_memory: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
          p_user_id: string
        }
        Returns: { id: string; chunk_text: string; similarity: number }[]
      }
      match_episodic_memory_scoped: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
          p_user_id: string
          p_context_key: string
        }
        Returns: { id: string; chunk_text: string; similarity: number }[]
      }
      users_share_classroom: {
        Args: { _other_user_id: string; _user_id: string }
        Returns: boolean
      }
      vote_on_doubt: {
        Args: { p_target_type: string; p_target_id: string; p_vote_type: number }
        Returns: Json
      }
      get_adaptive_play_questions: {
        Args: { p_domain: string; p_category: string; p_count?: number }
        Returns: {
          id: string
          content: Json
          options: Json
          correct_answer_index: number
          explanation: string | null
          difficulty_rating: number
          category: string
        }[]
      }
      record_play_result: {
        Args: {
          p_question_id: string
          p_is_correct: boolean
          p_time_taken_ms?: number | null
          p_category?: string | null
          p_pool_key?: string | null
        }
        Returns: undefined
      }
      get_daily_gauntlet_questions: {
        Args: { p_date: string; p_domain?: string }
        Returns: {
          id: string
          content: Json
          options: Json
          correct_answer_index: number
          explanation: string | null
          difficulty_rating: number
          category: string
        }[]
      }
      submit_daily_gauntlet: {
        Args: { p_gauntlet_date: string; p_results: Json }
        Returns: Json
      }
      toggle_lessons_raw_post_boost: {
        Args: { p_post_id: string }
        Returns: { boosted: boolean; boost_count: number }[]
      }
      vote_lessons_raw_post: {
        Args: { p_post_id: string; p_click: number }
        Returns: { score: number; up_count: number; down_count: number; my_vote: number }[]
      }
      get_daily_gauntlet_leaderboard: {
        Args: { p_gauntlet_date: string }
        Returns: { rank: number; user_id: string; display_name: string | null; correct_count: number; total_time_ms: number; completed_at: string }[]
      }
      increment_prep_calendar_day: {
        Args: { p_day: string; p_field: string }
        Returns: undefined
      }
      get_prep_calendar_summary: {
        Args: { p_today: string }
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
  public: {
    Enums: {
      app_role: ["admin", "teacher", "student"],
    },
  },
} as const
