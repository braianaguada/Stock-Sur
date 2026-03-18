import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/permissions";
import { canManageSettings } from "@/lib/permissions";

const SUPERADMIN_EMAILS = ["braianaguada@gmail.com"];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  roles: [],
  isAdmin: false,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRoles = async (userId: string | null) => {
      if (!userId) {
        setRoles([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) {
        const fallbackRoles: AppRole[] = userId ? ["user"] : [];
        setRoles(fallbackRoles);
      } else {
        const nextRoles = new Set<AppRole>((data ?? []).map((row) => row.role as AppRole));
        nextRoles.add("user");

        const sessionUser = (await supabase.auth.getUser()).data.user;
        if (sessionUser?.email && SUPERADMIN_EMAILS.includes(sessionUser.email.toLowerCase())) {
          nextRoles.add("superadmin");
          nextRoles.add("admin");
        }

        setRoles(Array.from(nextRoles));
      }

      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setLoading(true);
        await loadRoles(session?.user.id ?? null);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      await loadRoles(session?.user.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, roles, isAdmin: canManageSettings(roles), loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
