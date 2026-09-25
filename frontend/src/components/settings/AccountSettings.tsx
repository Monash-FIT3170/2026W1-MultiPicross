import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useSettings } from "./SettingsContext";
import profileIcon from "../../assets/settings/profile.svg";

export function AccountSettings() {

  const { status, user, logout } = useAuth();
  const navigate = useNavigate();
  const { closeSettings } = useSettings();

  const isAuthenticated = status === "authenticated";

  function handleSignIn() {
    closeSettings();
    navigate("/login");
  }

  async function handleSignOut() {
    await logout();
    closeSettings();
    navigate("/");
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-ink)] font-ui">
        Account
      </h2>

      <p className="mt-1 text-[14px] text-[var(--color-ink-muted)] font-ui">
        {isAuthenticated
          ? `Signed in as @${user?.handle}.`
          : "Manage your account and sign-in details."}
      </p>

      {!isAuthenticated ? (
        <div
          className="
            mt-8 flex flex-col items-center justify-center
            rounded-2xl
            border-2 border-[var(--color-line)]
            bg-[var(--color-surface-sunk)]
            px-8 py-12
            text-center
          "
        >
          <div
            className="
              flex h-11 w-11 items-center justify-center
              rounded-full
              border-2 border-[var(--color-line-strong)]
            "
          >
            <img
              src={profileIcon}
              alt=""
              aria-hidden="true"
              className="settings-icon h-5 w-5 opacity-60"
            />
          </div>

          <h3 className="mt-4 text-base text-[16px] font-bold text-[var(--color-ink)] font-ui">
            You're playing as a guest
          </h3>

          <p className="mt-2 max-w-md text-[14px] text-[var(--color-ink-muted)] font-ui">
            Sign in to manage your account and keep your settings across devices.
          </p>

          <button
            type="button"
            onClick={handleSignIn}
            className="
              mt-6 min-h-11 rounded-xl
              bg-[var(--color-blue-500)]
              px-6
              text-sm font-semibold
              text-white font-ui
              transition
              hover:opacity-90
            "
          >
            Sign in
          </button>
        </div>
      ) : (
        <div>
          <div className="mt-8 space-y-3">
            {/* Password */}
            <div
              className="
                flex items-center justify-between gap-6
                rounded-2xl
                border-2 border-[var(--color-line)]
                bg-[var(--color-surface)]
                px-5 py-4
              "
            >
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-ink)] font-ui">
                  Password
                </h3>

                <p className="mt-1 text-[13px] text-[var(--color-ink-muted)] font-ui">
                  Change the password used to access your account.
                </p>
              </div>

              <button
                type="button"
                className="
                  min-h-11 rounded-xl
                  border-1 border-[var(--color-line-strong)]
                  px-4
                  text-sm font-semibold
                  text-[var(--color-ink)] font-ui
                  transition hover:bg-[var(--color-surface-sunk)]
                "
              >
                Change
              </button>
            </div>

            {/* Sign out */}
            <div
              className="
                flex items-center justify-between gap-6
                rounded-2xl
                border-2 border-[var(--color-line)]
                bg-[var(--color-surface)]
                px-5 py-4
              "
            >
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-ink)] font-ui">
                  Sign out
                </h3>

                <p className="mt-1 text-[13px] text-[var(--color-ink-muted)] font-ui">
                  You'll keep playing as a guest.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="
                  min-h-11 rounded-xl
                  border-1 border-[var(--color-line-strong)]
                  px-4
                  text-sm font-semibold
                  text-[var(--color-ink)] font-ui
                  transition hover:bg-[var(--color-surface-sunk)]
                "
              >
                Sign out
              </button>
            </div>

            {/* Delete account */}
            <div
              className="
                flex items-center justify-between gap-6
                rounded-2xl
                border-2 border-[var(--color-accent-error)]
                bg-[var(--color-surface)]
                px-5 py-4
              "
            >
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-accent-error)] font-ui">
                  Delete account
                </h3>

                <p className="mt-1 text-[13px] text-[var(--color-ink-muted)] font-ui">
                  Permanently delete your account and its data.
                </p>
              </div>

              <button
                type="button"
                className="
                  min-h-11 rounded-xl
                  border-1 border-[var(--color-accent-error)]
                  px-4
                  text-sm font-semibold
                  text-[var(--color-accent-error)] font-ui
                  transition hover:opacity-80
                "
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}