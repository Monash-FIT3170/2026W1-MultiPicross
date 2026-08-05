import { useNavigate } from "react-router-dom";

export function PicrossRanked() {
  const navigate = useNavigate();
  return (
    <div className="page-placeholder">
      <h1>Picross Ranked</h1>
      <p>Learn how to play Picross.</p>

      <button
        className="rounded-xl bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-black"
        onClick={() => navigate("/")}
      >
        Main Menu
      </button>
    </div>
  );
}
