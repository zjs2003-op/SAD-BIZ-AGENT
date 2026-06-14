import { createClient } from "@supabase/supabase-js";
import type { BusinessMemory } from "@/types/business-memory";

export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient<{
    public: {
      Tables: {
        business_memory: {
          Row: BusinessMemory;
          Insert: Omit<BusinessMemory, "id" | "created_at" | "updated_at"> & {
            id?: string;
            created_at?: string;
            updated_at?: string;
          };
          Update: Partial<Omit<BusinessMemory, "id">>;
        };
      };
    };
  }>(supabaseUrl, supabaseAnonKey);
}
