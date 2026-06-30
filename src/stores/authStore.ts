import { create } from "zustand";
import { buildAuthorizeUrl } from "@/services/auth";
import { exchangeOAuthCode } from "@/lib/api";

interface AuthState {
  sessionToken: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  initiateOAuth: () => void;
  completeOAuth: (code: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  sessionToken: localStorage.getItem("optimow_session"),
  userId: localStorage.getItem("optimow_user"),
  isAuthenticated: !!localStorage.getItem("optimow_session"),

  initiateOAuth: () => { window.location.href = buildAuthorizeUrl(); },

  completeOAuth: async (code: string) => {
    const { session_token, user_id } = await exchangeOAuthCode(code);
    localStorage.setItem("optimow_session", session_token);
    localStorage.setItem("optimow_user", user_id);
    set({ sessionToken: session_token, userId: user_id, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem("optimow_session");
    localStorage.removeItem("optimow_user");
    set({ sessionToken: null, userId: null, isAuthenticated: false });
  },
}));
