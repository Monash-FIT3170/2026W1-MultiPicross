import React from "react";

type TutorialProps = {
  navigate: React.Dispatch<React.SetStateAction<string>>;
};

export function Tutorial({ navigate }: TutorialProps) {
  return (
    <div className="page-placeholder">
      <h1>Tutorial</h1>
      <p>Learn how to play Picross.</p>

      <button
        className="rounded-xl bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-black"
        onClick={() => navigate("mainmenu")}
      >
        Main Menu
      </button>
    </div>
  );
}
