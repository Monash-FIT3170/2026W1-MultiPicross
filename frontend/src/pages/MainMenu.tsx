
/* export default function MainMenu({ navigate }: any) {
  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Main Menu</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "200px", margin: "0 auto" }}>
        <button onClick={() => navigate("singleplayer")}>Singleplayer</button>
        <button onClick={() => navigate("multiplayer")}>Multiplayer</button>
        <button onClick={() => navigate("signin")}>Sign In</button>
        <button onClick={() => navigate("signup")}>Sign Up</button>
        <button onClick={() => navigate("tutorial")}>Tutorial</button>
        <button onClick={() => navigate("settings")}>Settings</button>
        <button onClick={() => navigate("stats")}>Statistics</button>
      </div>
    </div>
  );
} */

import "./MainMenu.css";
import singleplayerIcon from "../assets/singleplayer.png";
import multiIcon from "../assets/multiplayer.png";
import statsIcon from "../assets/stats.png";
import tutorialIcon from "../assets/tutorial.png";
import settingsIcon from "../assets/settings.png";

export default function MainMenu({ navigate }: any) {
  return (
    <div className="menu-container">

      {/* Top Right Auth Buttons */}
      <div className="menu-top-right">
        <button className="btn-outline" onClick={() => navigate("signin")}>
          Sign In
        </button>
        <button className="btn-filled" onClick={() => navigate("signup")}>
          Sign Up
        </button>
      </div>

      <h1 className="menu-title">  MultiPicross</h1>

      {/* Main Grid */}
      <div className="menu-grid">

        {/* Left Column */}
        <div className="menu-column">
          <button className="menu-card large" onClick={() => navigate("singleplayer")}>
            <img src={singleplayerIcon} className="menu-icon large" />
            <span>Singleplayer</span>
          </button>

          <button className="menu-card large" onClick={() => navigate("multiplayer")}>
            <img src={multiIcon} className="menu-icon large" />
            <span>Multiplayer</span>
          </button>
        </div>

        {/* Right Column */}
        <div className="menu-column">
          <button className="menu-card" onClick={() => navigate("stats")}>
            <img src={statsIcon} className="menu-icon" />
            <span>Statistics</span>
          </button>

          <button className="menu-card" onClick={() => navigate("tutorial")}>
            <img src={tutorialIcon} className="menu-icon" />
            <span>Tutorial</span>
          </button>

          <button className="menu-card" onClick={() => navigate("settings")}>
            <img src={settingsIcon} className="menu-icon" />
            <span>Settings</span>
          </button>
        </div>

      </div>
    </div>
  );
}