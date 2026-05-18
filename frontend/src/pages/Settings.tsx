import "./PagePlaceholder.css";
import { useNavigate } from "react-router-dom";

export function Settings() {
  const navigate = useNavigate();
  return (
    <div className="page-placeholder">
      <h1>Settings</h1>
      <p>Audio, display, and control settings.</p>

      <button
        className="rounded-xl bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-black"
        onClick={() => navigate("/")}
      >
        Main Menu
      </button>
    </div>
  );
}
