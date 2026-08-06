import { useNavigate } from "react-router-dom";
import { BackButton, Button, Logo } from "../components/ui";
import { useEffect, useState } from "react";

export function PicrossRanked() {
  const navigate = useNavigate();
  const [searching, setSearching] = useState(true);
  const [timedOut, setTimedOut] = useState(false);

{/* Finding a match */}
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearching(false);
      setTimedOut(true);
    }, 5000); // set time to 5 seconds for testing 

    return () => clearTimeout(timeout);
  }, []);

  {/* Continue to finding a match */}
  const continueSearching = () => {
  setTimedOut(false);
  setSearching(true);

  setTimeout(() => {
    setSearching(false);
    setTimedOut(true);
  }, 5000); // set time to 5 seconds for testing 
};

{/* Simulate match found */}
const simulateMatchFound = () => {
  navigate("/singleplayer"); // change to elo multiplayer game page when implemented in order to test
};

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-paper)",
        padding: "24px",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 28,
        }}
      >
        <BackButton 
          onClick={() => navigate("/")} 
          label="Main menu" 
        />

        <Logo size={34} />

        <div style={{ width: 100 }} />
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h1
          style={{
            margin: "0 0 4px",
            fontSize: 30,
            fontWeight: 700,
            color: "var(--color-ink)",
          }}
        >
          Picross Ranked
        </h1>

        <p
          style={{
            margin: "0 0 28px",
            color: "var(--color-ink-muted)",
            fontSize: 15,
          }}
        >
          Complete. Climb. Conquer.
        </p>


        {/* Searching Modal */}
        {searching && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
            }}
          >
            <div
              style={{
                width: 360,
                padding: 32,
                background: "var(--color-paper)",
                borderRadius: 20,
                boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
                textAlign: "center",
              }}
            >
              {/* Loading spinner */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  border: "4px solid var(--color-blue-100)",
                  borderTop: "4px solid var(--color-blue-500)",
                  borderRadius: "50%",
                  margin: "0 auto 20px",
                  animation: "spin 1s linear infinite",
                }}
              />

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--color-ink)",
                }}
              >
                Please wait...
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 15,
                  color: "var(--color-ink-muted)",
                }}
              >
                Finding matches
              </div>
            </div>
          </div>
        )}

        {/* No Match Modal */}
        {timedOut && (
        <div
            style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 100,
            }}
        >
            <div
            style={{
                width: 420,
                padding: 32,
                background: "var(--color-paper)",
                borderRadius: 20,
                textAlign: "center",
                boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
            }}
            >
            <h2
                style={{
                margin: 0,
                fontSize: 24,
                }}
            >
                No match found
            </h2>

            <p
                style={{
                marginTop: 12,
                color: "var(--color-ink-muted)",
                }}
            >
                We've been unable to find an opponent.
            </p>

            <div
                style={{
                display: "flex",
                justifyContent: "center",
                gap: 14,
                marginTop: 28,
                }}
            >
                <Button
                variant="ghost"
                onClick={() => navigate("/")}
                >
                Back Home
                </Button>

                <Button
                variant="primary"
                onClick={continueSearching}
                >
                Keep Searching
                </Button>
                
                <Button onClick={simulateMatchFound}>
                    Simulate Match
                </Button>
                
            </div>
    </div>
  </div>
)}

      </div>

      {/* Spinner animation */}
      <style>
        {`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
}
