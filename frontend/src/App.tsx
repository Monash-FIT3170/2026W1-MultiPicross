import heroImg from "./assets/hero.png";
import { Link } from "react-router-dom";
import { Route, Routes } from "react-router-dom";
import "./App.css";
import AccountCreationPage from "./AccountCreationPage";
import Board from "./components/Board";

function HomePage() {
  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
        </div>
        <div>
          <h1>MultiPicross</h1>
        </div>
        <Link className="account-link" to="/create-account">
          Create Account
        </Link>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <h2>Board desc</h2>
          <p>Left click to fill/unfill. Right click to place/remove a cross.</p>
        </div>
        <div id="social">
          <Board />
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/create-account" element={<AccountCreationPage />} />
      <Route path="/account-creation" element={<AccountCreationPage />} />
    </Routes>
  );
}

export default App;
