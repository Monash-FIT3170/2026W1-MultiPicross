import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function AuthError() {
  const { signIn } = useAuth();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
      <div className="w-full max-w-sm rounded-2xl bg-white px-8 py-10 text-center shadow-lg">
        <h2 className="text-lg font-semibold text-gray-800">Sign-in failed</h2>
        <p className="mt-2 text-sm text-gray-500">
          Something went wrong while signing you in. Please try again.
        </p>

        <button
          type="button"
          onClick={() => signIn()}
          className="mt-6 w-full rounded-xl bg-gray-900 py-2 font-semibold text-white transition hover:bg-black"
        >
          Try again
        </button>

        <Link
          to="/"
          className="mt-4 block text-sm font-medium text-[var(--color-accent-primary)] hover:underline"
        >
          Back to menu
        </Link>

        {code && (
          <p className="mt-6 text-xs text-gray-400">Error code: {code}</p>
        )}
      </div>
    </div>
  );
}
