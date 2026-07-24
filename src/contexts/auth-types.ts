import type { Tables } from "@/integrations/supabase/types";

export type CompanySummary = Pick<Tables<"companies">, "id" | "name" | "slug" | "status">;
