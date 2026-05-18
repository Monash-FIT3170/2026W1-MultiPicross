import singleplayerIcon from "../assets/singleplayer.svg";
import multiIcon from "../assets/multiplayer.svg";
import statsIcon from "../assets/stats.svg";
import tutorialIcon from "../assets/tutorial.svg";
import settingsIcon from "../assets/settings.svg";
import "../index.css";
import { useNavigate } from "react-router-dom";

export default function MainMenu() {
  const navigate = useNavigate();
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#fcfcfd]">
      {/* Top Right Auth Buttons */}
      <div className="absolute right-5 top-5 flex gap-3">
        <button
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700 hover:bg-gray-100"
          onClick={() => navigate("/login")}
        >
          Login
        </button>

        <button
          className="rounded-xl bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-black"
          onClick={() => navigate("/signup")}
        >
          Sign Up
        </button>
      </div>

      {/* Title */}
      <h1 className="mb-10 text-5xl font-bold text-gray-900">MultiPicross</h1>

      {/* Grid */}
      <div className="flex gap-10">
        {/* LEFT */}
        <div className="flex flex-col gap-5">
          <button
            onClick={() => navigate("/singleplayer")}
            className="flex h-[120px] w-[360px] flex-col items-center justify-center rounded-2xl border bg-white font-bold text-gray-900 shadow-xs transition hover:scale-[1.02] hover:text-black hover:bg-accent-primary-inverted hover:shadow-lg hover:invert"
          >
            <img src={singleplayerIcon} className="mb-2 h-12 w-12 " />
            Singleplayer
          </button>

          <button
            onClick={() => navigate("/multiplayer")}
            className="flex h-[120px] w-[360px] flex-col items-center justify-center rounded-2xl border bg-white font-bold text-gray-900 shadow-xs transition hover:scale-[1.02] hover:text-black hover:bg-accent-primary-inverted hover:shadow-lg hover:invert"
          >
            <img src={multiIcon} className="mb-2 h-12 w-12" />
            Multiplayer
          </button>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-5">
          <button
            onClick={() => navigate("/statistics")}
            className="flex h-[80px] w-[360px] items-center justify-center gap-3 rounded-2xl border bg-white font-bold shadow-xs transition hover:scale-[1.02] hover:text-black hover:bg-accent-primary-inverted hover:shadow-lg hover:invert"
          >
            <img src={statsIcon} className="h-7 w-7" />
            Statistics
          </button>

          <button
            onClick={() => navigate("/tutorial")}
            className="flex h-[80px] w-[360px] items-center justify-center gap-3 rounded-2xl border bg-white font-bold shadow-xs transition hover:scale-[1.02] hover:text-black hover:bg-accent-primary-inverted hover:shadow-lg hover:invert"
          >
            <img src={tutorialIcon} className="h-7 w-7" />
            Tutorial
          </button>

          <button
            onClick={() => navigate("/settings")}
            className="flex h-[80px] w-[360px] items-center justify-center gap-3 rounded-2xl border bg-white font-bold shadow-xs transition hover:scale-[1.02] hover:text-black hover:bg-accent-primary-inverted hover:shadow-lg hover:invert"
          >
            <img src={settingsIcon} className="h-7 w-7" />
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}
