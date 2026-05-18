import React from "react";

type SignupProps = {
  navigate: React.Dispatch<React.SetStateAction<string>>;
};

export function Signup({ navigate }: SignupProps) {
  return (
    <div className="page-placeholder">
      <h1>Sign Up</h1>
      <p>Registration form will go here.</p>

      <button
        className="rounded-xl bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-black"
        onClick={() => navigate("mainmenu")}
      >
        Main Menu
      </button>
    </div>
  );
}
