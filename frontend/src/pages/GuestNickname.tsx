import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function GuestNickname() {
  const [nickname, setNickname] = useState("");
  const { setGuestNickname } = useAuth();
  const navigate = useNavigate();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmed = nickname.trim();

    if (!trimmed) return;

    setGuestNickname(trimmed);
    navigate("/multiplayer");
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Choose a nickname</h1>

      <input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="Nickname"
        maxLength={20}
      />

      <button type="submit">Continue</button>
    </form>
  );
}