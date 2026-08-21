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
      agency_audit_events: {
        Row: {
          action: string
          actor_type: string
          actor_user_id: string | null
          changes: Json
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          occurred_at: string
          subject_user_id: string | null
        }
        Insert: {
          action: string
          actor_type?: string
          actor_user_id?: string | null
          changes?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          subject_user_id?: string | null
        }
        Update: {
          action?: string
          actor_type?: string
          actor_user_id?: string | null
          changes?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          subject_user_id?: string | null
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
      cleaner_availability: {
        Row: {
          cleaner_id: string
          created_at: string
          end_time: string
          id: string
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          cleaner_id: string
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          cleaner_id?: string
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_availability_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_bank_accounts: {
        Row: {
          account_holder_name: string
          account_number: string
          cleaner_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          sort_code: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          account_holder_name: string
          account_number: string
          cleaner_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_code: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          account_holder_name?: string
          account_number?: string
          cleaner_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_code?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_bank_accounts_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: true
            referencedRelation: "cleaner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_compliance_reminders: {
        Row: {
          attempts: number
          cleaner_id: string
          created_at: string
          id: string
          last_error: string | null
          reminder_type: string
          scheduled_for: string
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          cleaner_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          reminder_type: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          cleaner_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          reminder_type?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_compliance_reminders_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_job_notifications: {
        Row: {
          assignment_id: string
          attempts: number
          channel: string
          cleaner_id: string
          created_at: string
          id: string
          job_id: string
          last_error: string | null
          notification_type: string
          provider_reference: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          attempts?: number
          channel: string
          cleaner_id: string
          created_at?: string
          id?: string
          job_id: string
          last_error?: string | null
          notification_type: string
          provider_reference?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          attempts?: number
          channel?: string
          cleaner_id?: string
          created_at?: string
          id?: string
          job_id?: string
          last_error?: string | null
          notification_type?: string
          provider_reference?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_job_notifications_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "job_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_job_notifications_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_job_notifications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_payouts: {
        Row: {
          amount_pence: number
          approved_at: string | null
          bank_transfer_reference: string | null
          cleaner_id: string
          created_at: string
          currency: string
          earning_week_start: string | null
          held_reason: string | null
          id: string
          job_id: string
          paid_at: string | null
          pay_run_week_start: string | null
          provider: string | null
          provider_reference: string | null
          scheduled_pay_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_pence: number
          approved_at?: string | null
          bank_transfer_reference?: string | null
          cleaner_id: string
          created_at?: string
          currency?: string
          earning_week_start?: string | null
          held_reason?: string | null
          id?: string
          job_id: string
          paid_at?: string | null
          pay_run_week_start?: string | null
          provider?: string | null
          provider_reference?: string | null
          scheduled_pay_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_pence?: number
          approved_at?: string | null
          bank_transfer_reference?: string | null
          cleaner_id?: string
          created_at?: string
          currency?: string
          earning_week_start?: string | null
          held_reason?: string | null
          id?: string
          job_id?: string
          paid_at?: string | null
          pay_run_week_start?: string | null
          provider?: string | null
          provider_reference?: string | null
          scheduled_pay_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_payouts_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_payouts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_profiles: {
        Row: {
          admin_notes: string | null
          application_status: string
          approved_at: string | null
          approved_by: string | null
          bank_account_holder: string | null
          bank_account_last4: string | null
          bank_details_status: string
          bank_sort_code_last2: string | null
          created_at: string
          experience_summary: string | null
          full_name: string | null
          has_transport: boolean | null
          id: string
          operational_status: string
          payout_status: string
          phone: string | null
          postcode: string | null
          profile_photo_path: string | null
          updated_at: string
          user_id: string
          verification_status: string
        }
        Insert: {
          admin_notes?: string | null
          application_status?: string
          approved_at?: string | null
          approved_by?: string | null
          bank_account_holder?: string | null
          bank_account_last4?: string | null
          bank_details_status?: string
          bank_sort_code_last2?: string | null
          created_at?: string
          experience_summary?: string | null
          full_name?: string | null
          has_transport?: boolean | null
          id?: string
          operational_status?: string
          payout_status?: string
          phone?: string | null
          postcode?: string | null
          profile_photo_path?: string | null
          updated_at?: string
          user_id: string
          verification_status?: string
        }
        Update: {
          admin_notes?: string | null
          application_status?: string
          approved_at?: string | null
          approved_by?: string | null
          bank_account_holder?: string | null
          bank_account_last4?: string | null
          bank_details_status?: string
          bank_sort_code_last2?: string | null
          created_at?: string
          experience_summary?: string | null
          full_name?: string | null
          has_transport?: boolean | null
          id?: string
          operational_status?: string
          payout_status?: string
          phone?: string | null
          postcode?: string | null
          profile_photo_path?: string | null
          updated_at?: string
          user_id?: string
          verification_status?: string
        }
        Relationships: []
      }
      cleaner_service_areas: {
        Row: {
          cleaner_id: string
          service_area_id: string
        }
        Insert: {
          cleaner_id: string
          service_area_id: string
        }
        Update: {
          cleaner_id?: string
          service_area_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_service_areas_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_service_areas_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_service_capabilities: {
        Row: {
          cleaner_id: string
          service_type_id: string
        }
        Insert: {
          cleaner_id: string
          service_type_id: string
        }
        Update: {
          cleaner_id?: string
          service_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_service_capabilities_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_service_capabilities_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_time_off: {
        Row: {
          cleaner_id: string
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
        }
        Insert: {
          cleaner_id: string
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
        }
        Update: {
          cleaner_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_time_off_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_vetting_documents: {
        Row: {
          admin_notes: string | null
          cleaner_id: string
          document_type: string
          file_path: string
          id: string
          is_current: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          superseded_at: string | null
          uploaded_at: string
        }
        Insert: {
          admin_notes?: string | null
          cleaner_id: string
          document_type: string
          file_path: string
          id?: string
          is_current?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          superseded_at?: string | null
          uploaded_at?: string
        }
        Update: {
          admin_notes?: string | null
          cleaner_id?: string
          document_type?: string
          file_path?: string
          id?: string
          is_current?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          superseded_at?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_vetting_documents_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_vetting_records: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          address_status: string
          admin_notes: string | null
          citizenship_route: string | null
          city: string | null
          cleaner_id: string
          date_of_birth: string | null
          dbs_certificate_number: string | null
          dbs_status: string
          identity_status: string
          right_to_work_basis: string | null
          right_to_work_checked_at: string | null
          right_to_work_checked_by: string | null
          right_to_work_expires_on: string | null
          right_to_work_restrictions: string | null
          right_to_work_result_path: string | null
          right_to_work_share_code: string | null
          right_to_work_status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          address_status?: string
          admin_notes?: string | null
          citizenship_route?: string | null
          city?: string | null
          cleaner_id: string
          date_of_birth?: string | null
          dbs_certificate_number?: string | null
          dbs_status?: string
          identity_status?: string
          right_to_work_basis?: string | null
          right_to_work_checked_at?: string | null
          right_to_work_checked_by?: string | null
          right_to_work_expires_on?: string | null
          right_to_work_restrictions?: string | null
          right_to_work_result_path?: string | null
          right_to_work_share_code?: string | null
          right_to_work_status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          address_status?: string
          admin_notes?: string | null
          citizenship_route?: string | null
          city?: string | null
          cleaner_id?: string
          date_of_birth?: string | null
          dbs_certificate_number?: string | null
          dbs_status?: string
          identity_status?: string
          right_to_work_basis?: string | null
          right_to_work_checked_at?: string | null
          right_to_work_checked_by?: string | null
          right_to_work_expires_on?: string | null
          right_to_work_restrictions?: string | null
          right_to_work_result_path?: string | null
          right_to_work_share_code?: string | null
          right_to_work_status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_vetting_records_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: true
            referencedRelation: "cleaner_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      customer_addresses: {
        Row: {
          access_notes: string | null
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          created_at: string
          customer_id: string
          id: string
          postcode: string
          service_area_id: string | null
          updated_at: string
        }
        Insert: {
          access_notes?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          created_at?: string
          customer_id: string
          id?: string
          postcode: string
          service_area_id?: string | null
          updated_at?: string
        }
        Update: {
          access_notes?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          postcode?: string
          service_area_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payments: {
        Row: {
          amount_pence: number
          created_at: string
          currency: string
          id: string
          job_id: string
          paid_at: string | null
          provider: string | null
          provider_reference: string | null
          recurring_billing_cycle_id: string | null
          recurring_visit_id: string | null
          refund_amount_pence: number
          refund_reference: string | null
          refund_requested_at: string | null
          refund_status: string
          refunded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_pence: number
          created_at?: string
          currency?: string
          id?: string
          job_id: string
          paid_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          recurring_billing_cycle_id?: string | null
          recurring_visit_id?: string | null
          refund_amount_pence?: number
          refund_reference?: string | null
          refund_requested_at?: string | null
          refund_status?: string
          refunded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_pence?: number
          created_at?: string
          currency?: string
          id?: string
          job_id?: string
          paid_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          recurring_billing_cycle_id?: string | null
          recurring_visit_id?: string | null
          refund_amount_pence?: number
          refund_reference?: string | null
          refund_requested_at?: string | null
          refund_status?: string
          refunded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_recurring_billing_cycle_id_fkey"
            columns: ["recurring_billing_cycle_id"]
            isOneToOne: false
            referencedRelation: "recurring_clean_billing_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_recurring_visit_id_fkey"
            columns: ["recurring_visit_id"]
            isOneToOne: true
            referencedRelation: "recurring_clean_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          id: string
          name: string
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string
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
      email_suppressions: {
        Row: {
          bounce_type: string | null
          created_at: string
          email: string
          id: string
          notes: string | null
          reason: string
          source_resend_id: string | null
          suppressed_at: string
        }
        Insert: {
          bounce_type?: string | null
          created_at?: string
          email: string
          id?: string
          notes?: string | null
          reason?: string
          source_resend_id?: string | null
          suppressed_at?: string
        }
        Update: {
          bounce_type?: string | null
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
          reason?: string
          source_resend_id?: string | null
          suppressed_at?: string
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
      job_assignments: {
        Row: {
          assigned_by: string | null
          cleaner_id: string
          created_at: string
          id: string
          job_id: string
          offered_at: string
          responded_at: string | null
          response_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          cleaner_id: string
          created_at?: string
          id?: string
          job_id: string
          offered_at?: string
          responded_at?: string | null
          response_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          cleaner_id?: string
          created_at?: string
          id?: string
          job_id?: string
          offered_at?: string
          responded_at?: string | null
          response_notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_checklist_items: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          is_required: boolean
          job_id: string
          position: number
          title: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_required?: boolean
          job_id: string
          position?: number
          title: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_required?: boolean
          job_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_checklist_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "cleaner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_checklist_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          details: Json | null
          event_type: string
          id: string
          job_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          job_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_evidence: {
        Row: {
          assignment_id: string
          caption: string | null
          cleaner_id: string
          created_at: string
          evidence_type: string
          file_name: string
          id: string
          job_id: string
          mime_type: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          assignment_id: string
          caption?: string | null
          cleaner_id: string
          created_at?: string
          evidence_type: string
          file_name: string
          id?: string
          job_id: string
          mime_type: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          assignment_id?: string
          caption?: string | null
          cleaner_id?: string
          created_at?: string
          evidence_type?: string
          file_name?: string
          id?: string
          job_id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_evidence_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "job_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_evidence_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_evidence_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_issue_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          details: Json
          event_type: string
          id: string
          issue_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          issue_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          issue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_issue_events_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "job_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      job_issues: {
        Row: {
          assigned_to: string | null
          category: string
          closed_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          job_id: string
          reported_by: string | null
          resolution_notes: string | null
          resolved_at: string | null
          severity: string
          source: string
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          closed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          job_id: string
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string
          source: string
          status?: string
          summary: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          job_id?: string
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_issues_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_time_entries: {
        Row: {
          assignment_id: string
          cleaner_id: string
          clocked_in_at: string
          clocked_out_at: string | null
          corrected_at: string | null
          corrected_by: string | null
          corrected_minutes: number | null
          correction_reason: string | null
          created_at: string
          id: string
          job_id: string
        }
        Insert: {
          assignment_id: string
          cleaner_id: string
          clocked_in_at?: string
          clocked_out_at?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          corrected_minutes?: number | null
          correction_reason?: string | null
          created_at?: string
          id?: string
          job_id: string
        }
        Update: {
          assignment_id?: string
          cleaner_id?: string
          clocked_in_at?: string
          clocked_out_at?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          corrected_minutes?: number | null
          correction_reason?: string | null
          created_at?: string
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_time_entries_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "job_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_time_entries_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_time_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          accepted_quote_id: string
          address_id: string
          cleaner_completion_notes: string | null
          cleaner_payout_pence: number
          completed_at: string | null
          created_at: string
          currency: string
          customer_amount_pence: number
          customer_id: string
          expected_duration_minutes: number | null
          general_location: string
          id: string
          internal_notes: string | null
          quality_review_notes: string | null
          quality_review_status: string
          quality_reviewed_at: string | null
          quality_reviewed_by: string | null
          recurring_plan_id: string | null
          recurring_visit_id: string | null
          reference: string
          requirements: string | null
          schedule_confirmed_at: string | null
          schedule_confirmed_by: string | null
          scheduled_date: string
          scheduled_end_at: string | null
          scheduled_start_at: string | null
          service_area_id: string
          service_request_id: string
          service_type_id: string
          start_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_quote_id: string
          address_id: string
          cleaner_completion_notes?: string | null
          cleaner_payout_pence: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_amount_pence: number
          customer_id: string
          expected_duration_minutes?: number | null
          general_location: string
          id?: string
          internal_notes?: string | null
          quality_review_notes?: string | null
          quality_review_status?: string
          quality_reviewed_at?: string | null
          quality_reviewed_by?: string | null
          recurring_plan_id?: string | null
          recurring_visit_id?: string | null
          reference: string
          requirements?: string | null
          schedule_confirmed_at?: string | null
          schedule_confirmed_by?: string | null
          scheduled_date: string
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          service_area_id: string
          service_request_id: string
          service_type_id: string
          start_time?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_quote_id?: string
          address_id?: string
          cleaner_completion_notes?: string | null
          cleaner_payout_pence?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_amount_pence?: number
          customer_id?: string
          expected_duration_minutes?: number | null
          general_location?: string
          id?: string
          internal_notes?: string | null
          quality_review_notes?: string | null
          quality_review_status?: string
          quality_reviewed_at?: string | null
          quality_reviewed_by?: string | null
          recurring_plan_id?: string | null
          recurring_visit_id?: string | null
          reference?: string
          requirements?: string | null
          schedule_confirmed_at?: string | null
          schedule_confirmed_by?: string | null
          scheduled_date?: string
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          service_area_id?: string
          service_request_id?: string
          service_type_id?: string
          start_time?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_accepted_quote_id_fkey"
            columns: ["accepted_quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_recurring_plan_id_fkey"
            columns: ["recurring_plan_id"]
            isOneToOne: false
            referencedRelation: "recurring_clean_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_recurring_visit_id_fkey"
            columns: ["recurring_visit_id"]
            isOneToOne: true
            referencedRelation: "recurring_clean_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
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
          amount_paid: number | null
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
          amount_paid?: number | null
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
          amount_paid?: number | null
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
      platform_schema_versions: {
        Row: {
          applied_at: string
          description: string
          version: string
        }
        Insert: {
          applied_at?: string
          description: string
          version: string
        }
        Update: {
          applied_at?: string
          description?: string
          version?: string
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
      public_submission_rate_limits: {
        Row: {
          action: string
          key_hash: string
          request_count: number
          window_start: string
        }
        Insert: {
          action: string
          key_hash: string
          request_count?: number
          window_start: string
        }
        Update: {
          action?: string
          key_hash?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      quote_addons: {
        Row: {
          addon_code: string
          addon_id: string | null
          addon_name: string
          category: string
          created_at: string
          id: string
          quantity: number
          quote_id: string
          unit_cleaner_payout_pence: number
          unit_customer_price_pence: number
          unit_duration_minutes: number
        }
        Insert: {
          addon_code: string
          addon_id?: string | null
          addon_name: string
          category: string
          created_at?: string
          id?: string
          quantity?: number
          quote_id: string
          unit_cleaner_payout_pence: number
          unit_customer_price_pence: number
          unit_duration_minutes?: number
        }
        Update: {
          addon_code?: string
          addon_id?: string | null
          addon_name?: string
          category?: string
          created_at?: string
          id?: string
          quantity?: number
          quote_id?: string
          unit_cleaner_payout_pence?: number
          unit_customer_price_pence?: number
          unit_duration_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "service_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_addons_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          address_id: string | null
          cleaner_payout_pence: number
          created_at: string
          created_by: string | null
          currency: string
          customer_amount_pence: number
          expected_duration_minutes: number | null
          id: string
          notes: string | null
          payment_confirmation_sent_at: string | null
          payment_link_sent_at: string | null
          recurring_plan_id: string | null
          recurring_visit_id: string | null
          requirements: string | null
          scheduled_date: string | null
          sent_at: string | null
          service_request_id: string
          start_time: string | null
          status: string
          stripe_checkout_session_id: string | null
          updated_at: string
          valid_until: string | null
          version: number
        }
        Insert: {
          accepted_at?: string | null
          address_id?: string | null
          cleaner_payout_pence: number
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_amount_pence: number
          expected_duration_minutes?: number | null
          id?: string
          notes?: string | null
          payment_confirmation_sent_at?: string | null
          payment_link_sent_at?: string | null
          recurring_plan_id?: string | null
          recurring_visit_id?: string | null
          requirements?: string | null
          scheduled_date?: string | null
          sent_at?: string | null
          service_request_id: string
          start_time?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Update: {
          accepted_at?: string | null
          address_id?: string | null
          cleaner_payout_pence?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_amount_pence?: number
          expected_duration_minutes?: number | null
          id?: string
          notes?: string | null
          payment_confirmation_sent_at?: string | null
          payment_link_sent_at?: string | null
          recurring_plan_id?: string | null
          recurring_visit_id?: string | null
          requirements?: string | null
          scheduled_date?: string | null
          sent_at?: string | null
          service_request_id?: string
          start_time?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_recurring_plan_id_fkey"
            columns: ["recurring_plan_id"]
            isOneToOne: false
            referencedRelation: "recurring_clean_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_recurring_visit_id_fkey"
            columns: ["recurring_visit_id"]
            isOneToOne: true
            referencedRelation: "recurring_clean_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
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
      recurring_clean_billing_cycles: {
        Row: {
          amount_pence: number
          created_at: string
          currency: string
          id: string
          last_payment_error: string | null
          paid_at: string | null
          payment_attempts: number
          payment_intent_id: string | null
          period_end: string
          period_start: string
          plan_id: string
          scheduled_charge_date: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_pence: number
          created_at?: string
          currency?: string
          id?: string
          last_payment_error?: string | null
          paid_at?: string | null
          payment_attempts?: number
          payment_intent_id?: string | null
          period_end: string
          period_start: string
          plan_id: string
          scheduled_charge_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_pence?: number
          created_at?: string
          currency?: string
          id?: string
          last_payment_error?: string | null
          paid_at?: string | null
          payment_attempts?: number
          payment_intent_id?: string | null
          period_end?: string
          period_start?: string
          plan_id?: string
          scheduled_charge_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_clean_billing_cycles_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "recurring_clean_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_clean_plan_addons: {
        Row: {
          addon_code: string
          addon_id: string | null
          addon_name: string
          category: string
          created_at: string
          id: string
          plan_id: string
          quantity: number
          unit_cleaner_payout_pence: number
          unit_customer_price_pence: number
          unit_duration_minutes: number
        }
        Insert: {
          addon_code: string
          addon_id?: string | null
          addon_name: string
          category: string
          created_at?: string
          id?: string
          plan_id: string
          quantity: number
          unit_cleaner_payout_pence: number
          unit_customer_price_pence: number
          unit_duration_minutes?: number
        }
        Update: {
          addon_code?: string
          addon_id?: string | null
          addon_name?: string
          category?: string
          created_at?: string
          id?: string
          plan_id?: string
          quantity?: number
          unit_cleaner_payout_pence?: number
          unit_customer_price_pence?: number
          unit_duration_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_clean_plan_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "service_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_clean_plan_addons_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "recurring_clean_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_clean_plans: {
        Row: {
          address_id: string
          billing_frequency: string
          cancelled_at: string | null
          cleaner_payout_pence: number
          created_at: string
          created_by: string | null
          currency: string
          customer_amount_pence: number
          customer_id: string
          expected_duration_minutes: number
          frequency: string
          id: string
          internal_notes: string | null
          interval_count: number
          month_day: number | null
          next_billing_date: string
          next_visit_date: string
          paused_at: string | null
          payment_collection_days_before: number
          payment_setup_completed_at: string | null
          payment_setup_sent_at: string | null
          payment_setup_status: string
          requirements: string | null
          service_area_id: string
          service_type_id: string
          start_date: string
          start_time: string | null
          status: string
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          updated_at: string
          weekday: number | null
        }
        Insert: {
          address_id: string
          billing_frequency: string
          cancelled_at?: string | null
          cleaner_payout_pence: number
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_amount_pence: number
          customer_id: string
          expected_duration_minutes: number
          frequency: string
          id?: string
          internal_notes?: string | null
          interval_count?: number
          month_day?: number | null
          next_billing_date: string
          next_visit_date: string
          paused_at?: string | null
          payment_collection_days_before?: number
          payment_setup_completed_at?: string | null
          payment_setup_sent_at?: string | null
          payment_setup_status?: string
          requirements?: string | null
          service_area_id: string
          service_type_id: string
          start_date: string
          start_time?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          address_id?: string
          billing_frequency?: string
          cancelled_at?: string | null
          cleaner_payout_pence?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_amount_pence?: number
          customer_id?: string
          expected_duration_minutes?: number
          frequency?: string
          id?: string
          internal_notes?: string | null
          interval_count?: number
          month_day?: number | null
          next_billing_date?: string
          next_visit_date?: string
          paused_at?: string | null
          payment_collection_days_before?: number
          payment_setup_completed_at?: string | null
          payment_setup_sent_at?: string | null
          payment_setup_status?: string
          requirements?: string | null
          service_area_id?: string
          service_type_id?: string
          start_date?: string
          start_time?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          updated_at?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_clean_plans_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_clean_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_clean_plans_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_clean_plans_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_clean_visits: {
        Row: {
          billing_cycle_id: string | null
          charged_at: string | null
          created_at: string
          id: string
          job_id: string | null
          last_payment_error: string | null
          occurrence_number: number
          payment_attempts: number
          payment_intent_id: string | null
          plan_id: string
          quote_id: string | null
          scheduled_date: string
          service_request_id: string | null
          skipped_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          billing_cycle_id?: string | null
          charged_at?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          last_payment_error?: string | null
          occurrence_number: number
          payment_attempts?: number
          payment_intent_id?: string | null
          plan_id: string
          quote_id?: string | null
          scheduled_date: string
          service_request_id?: string | null
          skipped_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          billing_cycle_id?: string | null
          charged_at?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          last_payment_error?: string | null
          occurrence_number?: number
          payment_attempts?: number
          payment_intent_id?: string | null
          plan_id?: string
          quote_id?: string | null
          scheduled_date?: string
          service_request_id?: string | null
          skipped_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_clean_visits_billing_cycle_id_fkey"
            columns: ["billing_cycle_id"]
            isOneToOne: false
            referencedRelation: "recurring_clean_billing_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_clean_visits_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_clean_visits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "recurring_clean_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_clean_visits_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_clean_visits_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
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
      service_addons: {
        Row: {
          category: string
          cleaner_payout_pence: number
          code: string
          created_at: string
          customer_price_pence: number
          description: string | null
          display_order: number
          duration_minutes: number
          id: string
          is_active: boolean
          max_quantity: number
          name: string
          unit_label: string
          updated_at: string
        }
        Insert: {
          category: string
          cleaner_payout_pence: number
          code: string
          created_at?: string
          customer_price_pence: number
          description?: string | null
          display_order?: number
          duration_minutes?: number
          id?: string
          is_active?: boolean
          max_quantity?: number
          name: string
          unit_label?: string
          updated_at?: string
        }
        Update: {
          category?: string
          cleaner_payout_pence?: number
          code?: string
          created_at?: string
          customer_price_pence?: number
          description?: string | null
          display_order?: number
          duration_minutes?: number
          id?: string
          is_active?: boolean
          max_quantity?: number
          name?: string
          unit_label?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_areas: {
        Row: {
          country_code: string
          coverage_type: string
          coverage_values: string[]
          created_at: string
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          country_code?: string
          coverage_type?: string
          coverage_values?: string[]
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          coverage_type?: string
          coverage_values?: string[]
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_request_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          details: Json | null
          event_type: string
          id: string
          service_request_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          service_request_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          service_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_request_events_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          address_id: string
          admin_notes: string | null
          bathrooms: string | null
          bedrooms: string | null
          contacted_at: string | null
          created_at: string
          customer_id: string
          customer_notes: string | null
          frequency: string | null
          id: string
          lost_reason: string | null
          preferred_date_from: string | null
          preferred_date_to: string | null
          preferred_time: string | null
          property_type: string | null
          qualified_at: string | null
          reference: string
          service_area_id: string
          service_type_id: string
          source: string | null
          status: string
          updated_at: string
          utm_data: Json | null
        }
        Insert: {
          address_id: string
          admin_notes?: string | null
          bathrooms?: string | null
          bedrooms?: string | null
          contacted_at?: string | null
          created_at?: string
          customer_id: string
          customer_notes?: string | null
          frequency?: string | null
          id?: string
          lost_reason?: string | null
          preferred_date_from?: string | null
          preferred_date_to?: string | null
          preferred_time?: string | null
          property_type?: string | null
          qualified_at?: string | null
          reference: string
          service_area_id: string
          service_type_id: string
          source?: string | null
          status?: string
          updated_at?: string
          utm_data?: Json | null
        }
        Update: {
          address_id?: string
          admin_notes?: string | null
          bathrooms?: string | null
          bedrooms?: string | null
          contacted_at?: string | null
          created_at?: string
          customer_id?: string
          customer_notes?: string | null
          frequency?: string | null
          id?: string
          lost_reason?: string | null
          preferred_date_from?: string | null
          preferred_date_to?: string | null
          preferred_time?: string | null
          property_type?: string | null
          qualified_at?: string | null
          reference?: string
          service_area_id?: string
          service_type_id?: string
          source?: string | null
          status?: string
          updated_at?: string
          utm_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          pricing_mode: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          pricing_mode?: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          pricing_mode?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
      admin_override_job_stage: {
        Args: { p_job_id: string; p_reason: string; p_target_status: string }
        Returns: boolean
      }
      admin_override_service_request_stage: {
        Args: {
          p_reason: string
          p_request_id: string
          p_target_status: string
        }
        Returns: boolean
      }
      admin_review_job_completion: {
        Args: { p_decision: string; p_job_id: string; p_notes?: string }
        Returns: boolean
      }
      agency_audit_changes: {
        Args: { after_row: Json; before_row: Json }
        Returns: Json
      }
      agency_audit_redact: { Args: { payload: Json }; Returns: Json }
      approve_cleaner_payout: {
        Args: { p_payout_id: string }
        Returns: boolean
      }
      check_lead_reservation: {
        Args: { p_lead_id: string; p_visitor_id: string }
        Returns: {
          expires_at: string
          is_reserved: boolean
          reserved_by_me: boolean
        }[]
      }
      check_public_submission_rate_limit: {
        Args: {
          p_action: string
          p_key_hash: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: boolean
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
      cleaner_has_schedule_conflict: {
        Args: {
          p_cleaner_id: string
          p_end: string
          p_exclude_job_id?: string
          p_start: string
        }
        Returns: boolean
      }
      cleaner_is_available_for_window: {
        Args: { p_cleaner_id: string; p_end: string; p_start: string }
        Returns: boolean
      }
      cleaner_vetting_ready: {
        Args: { p_cleaner_id: string }
        Returns: boolean
      }
      clock_assigned_job: {
        Args: { p_action: string; p_assignment_id: string }
        Returns: Json
      }
      complete_assigned_job: {
        Args: { p_assignment_id: string; p_completion_notes?: string }
        Returns: boolean
      }
      complete_lead_reservation: {
        Args: { p_lead_id: string }
        Returns: undefined
      }
      correct_job_time_entry: {
        Args: { p_entry_id: string; p_minutes: number; p_reason: string }
        Returns: boolean
      }
      create_job_issue: {
        Args: {
          p_category: string
          p_description?: string
          p_due_at?: string
          p_job_id: string
          p_severity: string
          p_source: string
          p_summary: string
        }
        Returns: string
      }
      create_recurring_clean_plan: {
        Args: {
          p_addons?: Json
          p_address_id: string
          p_billing_frequency: string
          p_cleaner_payout_pence: number
          p_customer_amount_pence: number
          p_customer_id: string
          p_expected_duration_minutes: number
          p_frequency: string
          p_internal_notes?: string
          p_month_day?: number
          p_payment_collection_days_before?: number
          p_requirements?: string
          p_service_area_id: string
          p_service_type_id: string
          p_start_date: string
          p_start_time: string
          p_weekday?: number
        }
        Returns: string
      }
      deduct_credit_atomic: {
        Args: { p_lead_id: string; p_user_id: string }
        Returns: {
          error_message: string
          remaining_credits: number
          success: boolean
        }[]
      }
      dispatch_job_to_cleaner: {
        Args: { p_cleaner_id: string; p_job_id: string; p_reason?: string }
        Returns: Json
      }
      enforce_lead_unlock_rate_limit: {
        Args: { p_user_id: string }
        Returns: {
          allowed: boolean
          message: string
        }[]
      }
      finalize_agency_quote_payment: {
        Args: {
          p_payment_intent_id?: string
          p_payment_reference: string
          p_provider?: string
          p_quote_id: string
        }
        Returns: string
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
      get_job_dispatch_candidates: {
        Args: { p_job_id: string }
        Returns: {
          active_job_count: number
          available: boolean
          cleaner_id: string
          full_name: string
          has_conflict: boolean
          has_transport: boolean
          phone: string
          postcode: string
          service_areas: string[]
        }[]
      }
      get_managed_agency_health: { Args: never; Returns: Json }
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
      mark_cleaner_no_show: {
        Args: { p_job_id: string; p_reason: string }
        Returns: Json
      }
      mark_cleaner_payout_paid: {
        Args: { p_bank_reference: string; p_payout_id: string }
        Returns: boolean
      }
      next_cleaner_pay_date: { Args: { p_from_date?: string }; Returns: string }
      offer_job_to_cleaner: {
        Args: { p_cleaner_id: string; p_job_id: string }
        Returns: Json
      }
      pause_recurring_clean_plan: {
        Args: { p_paused: boolean; p_plan_id: string }
        Returns: boolean
      }
      record_customer_payment: {
        Args: {
          p_method: string
          p_paid_at?: string
          p_payment_id: string
          p_reference: string
        }
        Returns: boolean
      }
      record_manual_customer_refund: {
        Args: {
          p_payment_id: string
          p_reference: string
          p_refunded_at?: string
        }
        Returns: boolean
      }
      replace_my_cleaner_availability: {
        Args: { p_windows: Json }
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
      respond_to_job_assignment: {
        Args: { p_assignment_id: string; p_notes?: string; p_response: string }
        Returns: boolean
      }
      review_cleaner_bank_details: {
        Args: { p_cleaner_id: string; p_decision: string }
        Returns: boolean
      }
      set_job_checklist_item: {
        Args: { p_completed: boolean; p_item_id: string }
        Returns: boolean
      }
      submit_my_bank_details: {
        Args: {
          p_account_holder_name: string
          p_account_number: string
          p_sort_code: string
        }
        Returns: boolean
      }
      update_job_issue: {
        Args: {
          p_issue_id: string
          p_resolution_notes?: string
          p_status: string
        }
        Returns: boolean
      }
      withdraw_job_offer: {
        Args: { p_job_id: string; p_reason: string }
        Returns: boolean
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
