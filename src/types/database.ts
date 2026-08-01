// Hand-written to match supabase/migrations/0001_initial_schema.sql, in the
// same shape `supabase gen types typescript` would produce.
//
// Once a live Supabase project exists, regenerate from the real schema and
// replace this file:
//   supabase gen types typescript --project-id <ref> > src/types/database.ts

export type Role = "employee" | "manager" | "admin";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type WorkflowType = "onboarding" | "offboarding";
export type WorkflowStatus = "active" | "completed" | "cancelled";
export type OnboardingTaskStatus = "pending" | "in_progress" | "done";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          employee_code: string | null;
          role: Role;
          manager_id: string | null;
          site_id: string | null;
          // People Hub fields (migration 0008, HR-68). All nullable.
          job_title: string | null;
          department: string | null;
          start_date: string | null;
          birthday: string | null;
          about: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email?: string | null;
          employee_code?: string | null;
          role?: Role;
          manager_id?: string | null;
          site_id?: string | null;
          job_title?: string | null;
          department?: string | null;
          start_date?: string | null;
          birthday?: string | null;
          about?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      kudos: {
        Row: {
          id: string;
          giver_id: string;
          recipient_id: string;
          category: string;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          giver_id: string;
          recipient_id: string;
          category?: string;
          message: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["kudos"]["Insert"]>;
        Relationships: [];
      };
      sites: {
        Row: {
          id: string;
          name: string;
          latitude: number;
          longitude: number;
          radius_meters: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          latitude: number;
          longitude: number;
          radius_meters: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sites"]["Insert"]>;
        Relationships: [];
      };
      attendance: {
        Row: {
          id: string;
          user_id: string;
          site_id: string;
          check_in_at: string;
          check_in_lat: number;
          check_in_lng: number;
          check_out_at: string | null;
          check_out_lat: number | null;
          check_out_lng: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          site_id: string;
          check_in_at: string;
          check_in_lat: number;
          check_in_lng: number;
          check_out_at?: string | null;
          check_out_lat?: number | null;
          check_out_lng?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attendance"]["Insert"]>;
        Relationships: [];
      };
      leave_requests: {
        Row: {
          id: string;
          user_id: string;
          start_date: string;
          end_date: string;
          leave_type: string;
          reason: string;
          status: LeaveStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          start_date: string;
          end_date: string;
          leave_type: string;
          reason: string;
          status?: LeaveStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_comment?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leave_requests"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          message: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          message: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
      // Onboarding & offboarding workflows (migration 0009, HR-77).
      onboarding_workflows: {
        Row: {
          id: string;
          employee_id: string;
          workflow_type: WorkflowType;
          status: WorkflowStatus;
          target_date: string;
          created_by: string;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          employee_id: string;
          workflow_type: WorkflowType;
          status?: WorkflowStatus;
          target_date: string;
          created_by: string;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["onboarding_workflows"]["Insert"]>;
        Relationships: [];
      };
      onboarding_tasks: {
        Row: {
          id: string;
          workflow_id: string;
          employee_id: string;
          title: string;
          description: string | null;
          assignee_id: string | null;
          due_date: string | null;
          status: OnboardingTaskStatus;
          order_index: number;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workflow_id: string;
          employee_id: string;
          title: string;
          description?: string | null;
          assignee_id?: string | null;
          due_date?: string | null;
          status?: OnboardingTaskStatus;
          order_index?: number;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["onboarding_tasks"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
