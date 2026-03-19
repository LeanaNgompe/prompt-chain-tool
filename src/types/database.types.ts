export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      humor_flavors: {
        Row: {
          id: number
          description: string | null
          slug: string
        }
        Insert: {
          id?: number
          description?: string | null
          slug: string
        }
        Update: {
          id?: number
          description?: string | null
          slug?: string
        }
      }
      humor_flavor_steps: {
        Row: {
          id: number
          humor_flavor_id: number
          order_by: number
          description: string | null
          llm_system_prompt: string | null
          llm_user_prompt: string | null
          llm_temperature: number | null
          llm_model_id: number | null
          llm_input_type_id: number | null
          llm_output_type_id: number | null
          humor_flavor_step_type_id: number | null
        }
        Insert: {
          id?: number
          humor_flavor_id: number
          order_by: number
          description?: string | null
          llm_system_prompt?: string | null
          llm_user_prompt?: string | null
          llm_temperature?: number | null
          llm_model_id?: number | null
          llm_input_type_id?: number | null
          llm_output_type_id?: number | null
          humor_flavor_step_type_id?: number | null
        }
        Update: {
          id?: number
          humor_flavor_id?: number
          order_by?: number
          description?: string | null
          llm_system_prompt?: string | null
          llm_user_prompt?: string | null
          llm_temperature?: number | null
          llm_model_id?: number | null
          llm_input_type_id?: number | null
          llm_output_type_id?: number | null
          humor_flavor_step_type_id?: number | null
        }
      }
      profiles: {
        Row: {
          id: string
          is_superadmin: boolean
          is_matrix_admin: boolean
        }
        Insert: {
          id: string
          is_superadmin?: boolean
          is_matrix_admin?: boolean
        }
        Update: {
          id?: string
          is_superadmin?: boolean
          is_matrix_admin?: boolean
        }
      }
    }
  }
}
