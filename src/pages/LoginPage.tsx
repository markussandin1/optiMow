import { useAuthStore } from "@/stores/authStore";

export function LoginPage() {
  const initiateOAuth = useAuthStore((s) => s.initiateOAuth);
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4">
      <div className="mx-auto w-full max-w-md bg-white py-8 px-6 shadow rounded-lg text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">OptiMow Auto-Retry</h1>
        <p className="text-sm text-gray-600 mb-8">
          Logga in med Husqvarna så återupptar vi klippningen automatiskt när din
          klippare slirar eller fastnar.
        </p>
        <button
          onClick={initiateOAuth}
          className="w-full py-3 px-4 rounded-md text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"
        >
          Logga in med Husqvarna
        </button>
      </div>
    </div>
  );
}
