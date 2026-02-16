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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ad_platform_settings: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          is_enabled: boolean
          last_sync_at: string | null
          platform: string
          sync_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          is_enabled?: boolean
          last_sync_at?: string | null
          platform: string
          sync_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          is_enabled?: boolean
          last_sync_at?: string | null
          platform?: string
          sync_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ad_spend: {
        Row: {
          clicks: number | null
          conversions: number | null
          created_at: string
          currency: string
          date: string
          id: string
          impressions: number | null
          platform: string
          spend_amount: number
          synced_at: string
          updated_at: string
        }
        Insert: {
          clicks?: number | null
          conversions?: number | null
          created_at?: string
          currency?: string
          date: string
          id?: string
          impressions?: number | null
          platform: string
          spend_amount?: number
          synced_at?: string
          updated_at?: string
        }
        Update: {
          clicks?: number | null
          conversions?: number | null
          created_at?: string
          currency?: string
          date?: string
          id?: string
          impressions?: number | null
          platform?: string
          spend_amount?: number
          synced_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      business_inquiries: {
        Row: {
          admin_notes: string | null
          business_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          phone: string
          postcode: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          whatsapp_optin: boolean | null
        }
        Insert: {
          admin_notes?: string | null
          business_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          phone: string
          postcode: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          whatsapp_optin?: boolean | null
        }
        Update: {
          admin_notes?: string | null
          business_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          phone?: string
          postcode?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          whatsapp_optin?: boolean | null
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          responded_at: string | null
          responded_by: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      disputes: {
        Row: {
          created_at: string
          description: string | null
          evidence_urls: string[] | null
          id: string
          lead_id: string
          reason_code: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          evidence_urls?: string[] | null
          id?: string
          lead_id: string
          reason_code: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          evidence_urls?: string[] | null
          id?: string
          lead_id?: string
          reason_code?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          bounce_type: string | null
          bounced_at: string | null
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          id: string
          is_test: boolean | null
          opened_at: string | null
          recipient_email: string
          resend_id: string | null
          status: string
          subject: string
          template_id: string | null
          template_name: string | null
          updated_at: string
        }
        Insert: {
          bounce_type?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          is_test?: boolean | null
          opened_at?: string | null
          recipient_email: string
          resend_id?: string | null
          status?: string
          subject: string
          template_id?: string | null
          template_name?: string | null
          updated_at?: string
        }
        Update: {
          bounce_type?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          is_test?: boolean | null
          opened_at?: string | null
          recipient_email?: string
          resend_id?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          template_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequence_enrollments: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number
          enrolled_at: string
          id: string
          next_send_at: string | null
          recipient_email: string
          recipient_name: string | null
          recipient_type: string
          sequence_id: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          enrolled_at?: string
          id?: string
          next_send_at?: string | null
          recipient_email: string
          recipient_name?: string | null
          recipient_type?: string
          sequence_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          enrolled_at?: string
          id?: string
          next_send_at?: string | null
          recipient_email?: string
          recipient_name?: string | null
          recipient_type?: string
          sequence_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequence_logs: {
        Row: {
          clicked_at: string | null
          created_at: string
          enrollment_id: string
          id: string
          opened_at: string | null
          recipient_email: string
          resend_id: string | null
          sent_at: string
          status: string
          step_id: string
          subject: string
        }
        Insert: {
          clicked_at?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          opened_at?: string | null
          recipient_email: string
          resend_id?: string | null
          sent_at?: string
          status?: string
          step_id: string
          subject: string
        }
        Update: {
          clicked_at?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          opened_at?: string | null
          recipient_email?: string
          resend_id?: string | null
          sent_at?: string
          status?: string
          step_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sequence_logs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "email_sequence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequence_logs_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "email_sequence_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequence_steps: {
        Row: {
          body: string
          created_at: string
          delay_days: number
          delay_hours: number
          id: string
          is_active: boolean
          sequence_id: string
          step_order: number
          subject: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          delay_days?: number
          delay_hours?: number
          id?: string
          is_active?: boolean
          sequence_id: string
          step_order?: number
          subject: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          delay_days?: number
          delay_hours?: number
          id?: string
          is_active?: boolean
          sequence_id?: string
          step_order?: number
          subject?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequence_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequences: {
        Row: {
          audience_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          status: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          audience_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          audience_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string | null
          source: string
          source_id: string | null
          subscribed_at: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name?: string | null
          source: string
          source_id?: string | null
          subscribed_at?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string | null
          source?: string
          source_id?: string | null
          subscribed_at?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          subject: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          body: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          subject: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          body?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      failed_submissions: {
        Row: {
          created_at: string
          error_message: string | null
          form_data: Json
          id: string
          recovered_at: string | null
          recovered_lead_id: string | null
          retry_count: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          form_data: Json
          id?: string
          recovered_at?: string | null
          recovered_lead_id?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          form_data?: Json
          id?: string
          recovered_at?: string | null
          recovered_lead_id?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      fraud_flags: {
        Row: {
          created_at: string
          description: string | null
          flag_type: string
          id: string
          lead_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          flag_type: string
          id?: string
          lead_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          flag_type?: string
          id?: string
          lead_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fraud_flags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_reservations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          lead_id: string
          reserved_at: string
          status: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          lead_id: string
          reserved_at?: string
          status?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          lead_id?: string
          reserved_at?: string
          status?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_reservations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          admin_notes: string | null
          auto_publish_at: string | null
          bedrooms: string | null
          booked_date: string | null
          confirmation_method: string | null
          confirmation_response: string | null
          confirmation_sent_at: string | null
          created_at: string
          credit_type: string | null
          customer_address: string
          customer_email: string
          customer_name: string
          customer_phone: string
          date: string
          display_value: string
          expired_at: string | null
          frequency: string | null
          id: string
          is_unlocked: boolean
          job_completed_at: string | null
          job_notes: string | null
          job_status: string | null
          job_type: string
          lead_status: string | null
          lost_reason: string | null
          outcome_notes: string | null
          outcome_status: string | null
          outcome_updated_at: string | null
          postcode: string
          property_type: string | null
          published_at: string | null
          quality_score: number | null
          refund_reason: string | null
          refunded_at: string | null
          sms_reminders_sent: string[] | null
          source: string | null
          unlocked_at: string | null
          unlocked_by: string | null
          updated_at: string
          utm_data: Json | null
          validated_at: string | null
          value: number
        }
        Insert: {
          admin_notes?: string | null
          auto_publish_at?: string | null
          bedrooms?: string | null
          booked_date?: string | null
          confirmation_method?: string | null
          confirmation_response?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          credit_type?: string | null
          customer_address: string
          customer_email: string
          customer_name: string
          customer_phone: string
          date: string
          display_value: string
          expired_at?: string | null
          frequency?: string | null
          id?: string
          is_unlocked?: boolean
          job_completed_at?: string | null
          job_notes?: string | null
          job_status?: string | null
          job_type: string
          lead_status?: string | null
          lost_reason?: string | null
          outcome_notes?: string | null
          outcome_status?: string | null
          outcome_updated_at?: string | null
          postcode: string
          property_type?: string | null
          published_at?: string | null
          quality_score?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          sms_reminders_sent?: string[] | null
          source?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
          utm_data?: Json | null
          validated_at?: string | null
          value: number
        }
        Update: {
          admin_notes?: string | null
          auto_publish_at?: string | null
          bedrooms?: string | null
          booked_date?: string | null
          confirmation_method?: string | null
          confirmation_response?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          credit_type?: string | null
          customer_address?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          date?: string
          display_value?: string
          expired_at?: string | null
          frequency?: string | null
          id?: string
          is_unlocked?: boolean
          job_completed_at?: string | null
          job_notes?: string | null
          job_status?: string | null
          job_type?: string
          lead_status?: string | null
          lost_reason?: string | null
          outcome_notes?: string | null
          outcome_status?: string | null
          outcome_updated_at?: string | null
          postcode?: string
          property_type?: string | null
          published_at?: string | null
          quality_score?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          sms_reminders_sent?: string[] | null
          source?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
          utm_data?: Json | null
          validated_at?: string | null
          value?: number
        }
        Relationships: []
      }
      login_history: {
        Row: {
          city: string | null
          country: string | null
          id: string
          ip_address: string | null
          login_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          id?: string
          ip_address?: string | null
          login_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          id?: string
          ip_address?: string | null
          login_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          id: string
          page_path: string
          page_title: string | null
          referrer: string | null
          region: string | null
          session_id: string
          time_on_page: number | null
          user_agent: string | null
          visitor_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          page_path: string
          page_title?: string | null
          referrer?: string | null
          region?: string | null
          session_id: string
          time_on_page?: number | null
          user_agent?: string | null
          visitor_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          page_path?: string
          page_title?: string | null
          referrer?: string | null
          region?: string | null
          session_id?: string
          time_on_page?: number | null
          user_agent?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      phone_verification_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          locked_until: string | null
          phone: string
          user_id: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at: string
          id?: string
          locked_until?: string | null
          phone: string
          user_id: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          locked_until?: string | null
          phone?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_verified: boolean
          business_name: string | null
          closed_at: string | null
          closed_reason: string | null
          contact_name: string | null
          created_at: string
          credits: number
          granted_credits: number
          id: string
          is_closed: boolean | null
          is_suspended: boolean | null
          is_verified: boolean
          last_login: string | null
          leads_purchased: number
          phone: string | null
          phone_verified: boolean
          postcode: string | null
          risk_score: number | null
          suspension_reason: string | null
          updated_at: string
          user_id: string
          verification_status: string | null
          whatsapp_optin: boolean | null
        }
        Insert: {
          address_verified?: boolean
          business_name?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          contact_name?: string | null
          created_at?: string
          credits?: number
          granted_credits?: number
          id?: string
          is_closed?: boolean | null
          is_suspended?: boolean | null
          is_verified?: boolean
          last_login?: string | null
          leads_purchased?: number
          phone?: string | null
          phone_verified?: boolean
          postcode?: string | null
          risk_score?: number | null
          suspension_reason?: string | null
          updated_at?: string
          user_id: string
          verification_status?: string | null
          whatsapp_optin?: boolean | null
        }
        Update: {
          address_verified?: boolean
          business_name?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          contact_name?: string | null
          created_at?: string
          credits?: number
          granted_credits?: number
          id?: string
          is_closed?: boolean | null
          is_suspended?: boolean | null
          is_verified?: boolean
          last_login?: string | null
          leads_purchased?: number
          phone?: string | null
          phone_verified?: boolean
          postcode?: string | null
          risk_score?: number | null
          suspension_reason?: string | null
          updated_at?: string
          user_id?: string
          verification_status?: string | null
          whatsapp_optin?: boolean | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          created_at: string
          id: string
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          request_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      scheduled_emails: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          html_body: string
          id: string
          is_test: boolean | null
          recipient_email: string
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string
          template_id: string | null
          template_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          html_body: string
          id?: string
          is_test?: boolean | null
          recipient_email: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
          template_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          html_body?: string
          id?: string
          is_test?: boolean | null
          recipient_email?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          template_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_id: string
          sender_type?: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_id?: string
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          id: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_documents: {
        Row: {
          admin_notes: string | null
          created_at: string
          document_type: string
          expiry_date: string | null
          file_path: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          document_type: string
          expiry_date?: string | null
          file_path: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          document_type?: string
          expiry_date?: string | null
          file_path?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_lead_reservation: {
        Args: { p_lead_id: string; p_visitor_id: string }
        Returns: {
          expires_at: string
          is_reserved: boolean
          reserved_by_me: boolean
        }[]
      }
      check_rate_limit: {
        Args: {
          p_action: string
          p_max_requests?: number
          p_user_id: string
          p_window_seconds?: number
        }
        Returns: {
          allowed: boolean
          current_count: number
          reset_at: string
        }[]
      }
      complete_lead_reservation: {
        Args: { p_lead_id: string }
        Returns: undefined
      }
      deduct_credit_atomic: {
        Args: { p_lead_id: string; p_user_id: string }
        Returns: {
          error_message: string
          remaining_credits: number
          success: boolean
        }[]
      }
      enforce_lead_unlock_rate_limit: {
        Args: { p_user_id: string }
        Returns: {
          allowed: boolean
          message: string
        }[]
      }
      get_available_leads: {
        Args: never
        Returns: {
          created_at: string
          date: string
          display_value: string
          id: string
          job_type: string
          postcode: string
        }[]
      }
      get_user_email: { Args: { user_uuid: string }; Returns: string }
      get_user_leads_with_access_control: {
        Args: { p_user_id: string }
        Returns: {
          access_expires_at: string
          bedrooms: string
          booked_date: string
          customer_address: string
          customer_email: string
          customer_name: string
          customer_phone: string
          date: string
          display_value: string
          frequency: string
          id: string
          is_access_expired: boolean
          job_completed_at: string
          job_notes: string
          job_status: string
          job_type: string
          postcode: string
          property_type: string
          unlocked_at: string
          value: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_leads_purchased: {
        Args: { user_uuid: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_lead_access_expired: {
        Args: { unlocked_at_param: string }
        Returns: boolean
      }
      reserve_lead: {
        Args: { p_lead_id: string; p_visitor_id: string }
        Returns: {
          expires_at: string
          message: string
          reservation_id: string
          success: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "super_admin"
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
      app_role: ["admin", "super_admin"],
    },
  },
} as const
