import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

export function CallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const completeOAuth = useAuthStore((s) => s.completeOAuth);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    (async () => {
      const code = params.get("code");
      const oauthError = params.get("error");
      if (oauthError) { setError(oauthError); return; }
      if (!code) { setError("Missing authorization code"); return; }
      try {
        await completeOAuth(code);
        navigate("/", { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Login failed");
      }
    })();
  }, [params, navigate, completeOAuth]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white py-8 px-6 shadow rounded-lg text-center max-w-md w-full">
        {error
          ? <>
              <h2 className="text-lg font-medium text-gray-900 mb-2">Login failed</h2>
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <button onClick={() => navigate("/login", { replace: true })}
                className="py-2 px-4 rounded-md text-sm text-white bg-orange-600 hover:bg-orange-700">
                Try again
              </button>
            </>
          : <p className="text-sm text-gray-600">Logging in…</p>}
      </div>
    </div>
  );
}
