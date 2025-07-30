import { useAuthActions, useAuth } from '@/stores/authStore';

export function LoginPage() {
  const { isLoading, error } = useAuth();
  const { initiateOAuth, clearError } = useAuthActions();
  

  const handleHusqvarnaLogin = async () => {
    try {
      await initiateOAuth();
    } catch (error) {
      console.error('OAuth initiation failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            OptiMow v3
          </h1>
          <h2 className="text-xl text-gray-600">
            Husqvarna Mower Monitor
          </h2>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mb-6">
              <svg className="mx-auto h-12 w-12 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-6 6c-2.674 0-5.047-1.393-6.364-3.5l-1.636.5L8 10l1.5-1L11 8l1.5-1 1.5 1 1.5 1.5-1.5 1.5L11 12l-1.5 1L8 14l1 1.636c1.453 1.271 3.69 2.364 6.364 2.364A6 6 0 0021 9z" />
              </svg>
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Connect to Husqvarna
            </h3>
            
            <p className="text-sm text-gray-600 mb-8">
              To access your mower data, authorize OptiMow to securely connect to your Husqvarna account.
            </p>

            {error && (
              <div className="rounded-md bg-red-50 p-4 mb-6">
                <div className="text-sm text-red-700">
                  {error}
                </div>
              </div>
            )}

            <button
              onClick={handleHusqvarnaLogin}
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  Login with Husqvarna
                </>
              )}
            </button>

            {error && (
              <button
                onClick={clearError}
                className="mt-3 text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Try Again
              </button>
            )}
          </div>

          <div className="mt-6">
            <div className="text-xs text-gray-500 text-center">
              <p>OptiMow securely connects to your Husqvarna account</p>
              <p>to monitor your mower's status and activity.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}