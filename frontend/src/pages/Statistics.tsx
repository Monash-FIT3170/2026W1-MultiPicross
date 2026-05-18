import { useNavigate } from "react-router-dom";

export function Statistics() {
  const navigate = useNavigate();
  return (
    <div className="page-placeholder">
      <h1>Statistics</h1>
      <p>Your puzzle stats and achievements.</p>

      <button
        className="rounded-xl bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-black"
        onClick={() => navigate("/")}
      >
        Main Menu
      </button>
    </div>
  );
}
