import React from "react";

type LoginProps = {
  navigate: React.Dispatch<React.SetStateAction<string>>;
};

export function Login({ navigate }: LoginProps) {
  return (
    <div className="page-placeholder">
      <h1>Sign In</h1>
      <p>Login form will go here.</p>

      <button
        className="rounded-xl bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-black"
        onClick={() => navigate("mainmenu")}
      >
        Main Menu
      </button>
    </div>
  );
}
