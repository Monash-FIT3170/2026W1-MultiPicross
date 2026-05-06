import { Link } from "react-router-dom";

function AccountCreationPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-[var(--bg)] px-5 py-8">
      <section className="w-full max-w-[420px]">
        <div className="mb-7 text-left">
          <p className="mb-2 text-sm font-bold uppercase text-[var(--accent)]">
            MultiPicross
          </p>
          <h1 className="m-0 mb-2.5 text-[42px] font-medium text-[var(--text-h)]">
            Create account
          </h1>
          <p className="m-0 text-[var(--text)]">
            Create a game to play with friends.
          </p>
        </div>

        <form className="grid gap-4">
          <label className="grid gap-2 text-left text-[15px] font-semibold text-[var(--text-h)]">
            Display name
            <input
              className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 font-[inherit] text-[var(--text-h)] outline-offset-2 focus:border-[var(--accent)] focus:outline-2 focus:outline-[var(--accent-border)]"
              name="displayName"
              type="text"
              autoComplete="nickname"
            />
          </label>

          <label className="grid gap-2 text-left text-[15px] font-semibold text-[var(--text-h)]">
            Email
            <input
              className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 font-[inherit] text-[var(--text-h)] outline-offset-2 focus:border-[var(--accent)] focus:outline-2 focus:outline-[var(--accent-border)]"
              name="email"
              type="email"
              autoComplete="email"
            />
          </label>

          <label className="grid gap-2 text-left text-[15px] font-semibold text-[var(--text-h)]">
            Password
            <input
              className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 font-[inherit] text-[var(--text-h)] outline-offset-2 focus:border-[var(--accent)] focus:outline-2 focus:outline-[var(--accent-border)]"
              name="password"
              type="password"
              autoComplete="new-password"
            />
          </label>

          <button
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-transparent bg-[var(--accent)] px-3.5 py-2.5 text-base font-semibold leading-tight text-white hover:shadow-[var(--shadow)]"
            type="submit"
          >
            Create account
          </button>
        </form>

        <Link
          className="mt-5 inline-flex font-semibold text-[var(--accent)] no-underline"
          to="/"
        >
          Back home
        </Link>
      </section>
    </main>
  );
}

export default AccountCreationPage;
