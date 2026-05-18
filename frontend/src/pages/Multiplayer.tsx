import { useNavigate } from "react-router-dom";


export function Multiplayer() {
  const navigate = useNavigate();
  return (
    <div className="page-placeholder">
      <h1>Multiplayer</h1>
      <p>Room browser and matchmaking will go here.</p>

      <button
        className="rounded-xl bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-black"
        onClick={() => navigate("")}
      >
        Main Menu
      </button>
    </div>
  );
}
