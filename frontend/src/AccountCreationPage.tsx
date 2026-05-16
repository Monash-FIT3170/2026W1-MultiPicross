import { Link } from "react-router-dom";
import heroImg from "./assets/hero.png";
import "./AccountCreationPage.css";

function AccountCreationPage() {
  return (
    <>
      <section id="center" className="account-hero">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
        </div>
        <div className="account-title">
          <h1>Create Account</h1>
          <p>Start a MultiPicross profile for saving games and playing online.</p>
        </div>
        <Link className="account-link secondary" to="/">
          Back to Main Page
        </Link>
      </section>

      <div className="ticks"></div>

      <section id="next-steps" className="account-create-section">
        <div id="docs">
          <h2>Account Details</h2>
          <p>Choose your display name and sign-in details.</p>
        </div>
        <div id="social">
          <form className="account-form" action="#" method="POST">
            <label htmlFor="username">Display name</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              placeholder="PuzzlePlayer"
            />

            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Choose a password"
            />

            <button type="submit">Create Account</button>
          </form>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  );
}

export default AccountCreationPage;
