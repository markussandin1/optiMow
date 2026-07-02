import { useEffect, useState, useCallback } from "react";
import { callAppApi } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { errorCodeText } from "@/lib/husqvarnaErrorCodes";

const OUTCOME_LABELS: Record<string, string> = {
  confirmed_and_resumed: "Bekräftade felet och återupptog klippning",
  resume_failed: "Bekräftade felet, men kunde inte återuppta",
  confirm_failed: "Kunde inte bekräfta felet",
  gave_up: "Gav upp efter flera försök – behöver manuell hjälp",
  recovered: "Klipparen återhämtade sig",
};
const outcomeLabel = (o: string) => OUTCOME_LABELS[o] ?? o;

interface LogEntry { occurred_at: string; error_code: number; outcome: string }
interface Mower {
  id: string; name: string; auto_retry: boolean;
  needs_manual_help: boolean; attempts: number; log: LogEntry[];
}
interface Available { id: string; name: string }

export function DashboardPage() {
  const logout = useAuthStore((s) => s.logout);
  const [mowers, setMowers] = useState<Mower[]>([]);
  const [available, setAvailable] = useState<Available[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { mowers } = await callAppApi("list");
      setMowers(mowers);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte hämta klippare");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const discover = async () => {
    const { available } = await callAppApi("discover");
    setAvailable(available);
  };
  const register = async (m: Available) => {
    await callAppApi("register", { id: m.id, name: m.name });
    setAvailable((a) => a.filter((x) => x.id !== m.id));
    await load();
  };
  const toggle = async (m: Mower) => {
    await callAppApi("toggle", { id: m.id, auto_retry: !m.auto_retry });
    await load();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">OptiMow Auto-Retry</h1>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700 underline">
            Logga ut
          </button>
        </div>

        {error && <div className="rounded-md bg-red-50 p-3 mb-4 text-sm text-red-700">{error}</div>}

        {loading ? <p className="text-sm text-gray-600">Laddar…</p> : (
          <div className="space-y-4">
            {mowers.length === 0 && <p className="text-sm text-gray-600">Inga registrerade klippare ännu.</p>}
            {mowers.map((m) => (
              <div key={m.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{m.name}</div>
                    {m.needs_manual_help && (
                      <div className="text-xs text-red-600 mt-1">Behöver manuell hjälp (gav upp efter {m.attempts} försök)</div>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    Auto-retry
                    <input type="checkbox" checked={m.auto_retry} onChange={() => toggle(m)} className="h-4 w-4" />
                  </label>
                </div>
                {m.log.length > 0 && (
                  <ul className="mt-3 border-t pt-2 text-xs text-gray-500 space-y-1">
                    {m.log.map((l, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="whitespace-nowrap">{new Date(l.occurred_at).toLocaleString("sv-SE")}</span>
                        <span className="text-right">
                          {outcomeLabel(l.outcome)}
                          {l.error_code ? ` · ${errorCodeText(l.error_code)} (kod ${l.error_code})` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <button onClick={discover} className="text-sm py-2 px-4 rounded-md text-white bg-orange-600 hover:bg-orange-700">
            Hitta nya klippare
          </button>
          {available.length > 0 && (
            <ul className="mt-3 space-y-2">
              {available.map((m) => (
                <li key={m.id} className="flex items-center justify-between bg-white rounded-md shadow px-4 py-2">
                  <span className="text-sm text-gray-900">{m.name}</span>
                  <button onClick={() => register(m)} className="text-sm text-orange-600 hover:underline">
                    Registrera
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
