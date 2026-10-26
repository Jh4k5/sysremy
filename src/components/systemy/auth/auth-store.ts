"use client";

/**
 * مخزن حالة المصادقة السحابية (Supabase) — اختيارية فوق التخزين المحلي.
 * الجلسة تعيش في جهاز المستخدم (localStorage بمفتاح systemy-auth).
 * الملف الشخصي من جدول profiles — مع تدرّج صادق إن غاب الجدول/السياسات.
 */
import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useUIStore } from "@/store/ui-store";

export type AuthMode = "login" | "signup" | "forgot" | "reset";

export type ProfileStatus = "idle" | "ok" | "missing-table" | "denied" | "error";

export interface CloudProfile {
  display_name: string | null;
  avatar_url: string | null;
}

interface AuthState {
  /** تمّت قراءة الجلسة الابتدائية (لمنع وميض «غير مسجّل») */
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: CloudProfile | null;
  profileStatus: ProfileStatus;
  /** توكن استعادة كلمة المرور فعّال (نموذج كلمة مرور جديدة) */
  recovery: boolean;

  init: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

/** قفل تهيئة واحدة لكل تحميل صفحة (نمط systemsSeedStarted) */
let authInitialized = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  ready: false,
  session: null,
  user: null,
  profile: null,
  profileStatus: "idle",
  recovery: false,

  init: () => {
    if (authInitialized) return;
    authInitialized = true;
    if (!supabase) {
      set({ ready: true });
      return;
    }
    supabase.auth.onAuthStateChange((event, session) => {
      // رابط استعادة كلمة المرور → افتح نموذج كلمة مرور جديدة
      if (event === "PASSWORD_RECOVERY") {
        set({ recovery: true });
        useUIStore.getState().openAuth("reset");
      }
      set({ session, user: session?.user ?? null });

      if (event === "SIGNED_IN" && session) void get().refreshProfile();
      if (event === "SIGNED_OUT") {
        set({ profile: null, profileStatus: "idle", recovery: false });
      }
      if (event === "INITIAL_SESSION") set({ ready: true });
    });
  },

  refreshProfile: async () => {
    const client = supabase;
    const user = get().user;
    if (!client || !user) return;
    try {
      const { data, error } = await client
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        const code = (error as { code?: string }).code ?? "";
        const denied = code === "42501" || /permission|policy/i.test(error.message);
        set({
          profile: null,
          profileStatus: code === "PGRST205" ? "missing-table" : denied ? "denied" : "error",
        });
        return;
      }

      if (!data) {
        // الجدول موجود والصف غائب — أنشئ ملفاً من بيانات الدخول (insert own عبر RLS)
        const fallbackName =
          (user.user_metadata?.full_name as string | undefined)?.trim() ||
          user.email?.split("@")[0] ||
          "";
        const { data: inserted, error: insErr } = await client
          .from("profiles")
          .insert({ id: user.id, display_name: fallbackName })
          .select("display_name, avatar_url")
          .single();
        if (insErr) {
          const denied = (insErr as { code?: string }).code === "42501" || /permission|policy/i.test(insErr.message);
          set({ profile: null, profileStatus: denied ? "denied" : "error" });
          return;
        }
        set({ profile: inserted as CloudProfile, profileStatus: "ok" });
        return;
      }

      set({ profile: data as CloudProfile, profileStatus: "ok" });
    } catch {
      set({ profile: null, profileStatus: "error" });
    }
  },

  signOut: async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } finally {
      set({ session: null, user: null, profile: null, profileStatus: "idle", recovery: false });
    }
  },
}));
