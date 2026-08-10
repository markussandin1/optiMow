import { create } from "zustand";
import { buildAuthorizeUrl } from "@/services/auth";
import { exchangeOAuthCode, clearSession } from "@/lib/api";

interface AuthState {
  sessionToken: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  initiateOAuth: () => void;
  completeOAuth: (code: string) => Promise<void>;
  logout: () => void;
}

// The session token is a JWT; treat it as absent if its exp has passed
// so a stale localStorage entry doesn't leave the UI "logged in".
function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

const storedToken = localStorage.getItem("optimow_session");
const validToken = isTokenValid(storedToken);
if (storedToken && !validToken) clearSession();

export const useAuthStore = create<AuthState>((set) => ({
  sessionToken: validToken ? storedToken : null,
  userId: validToken ? localStorage.getItem("optimow_user") : null,
  isAuthenticated: validToken,

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
