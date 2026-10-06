//import { useNavigate } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { fmtSeconds } from "../components/NonogramGrid";

export function RankedMultiplayerResults() {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    winnerId,
    mySessionId,
    me,
    opponent,
    width,
    height,
    displaySeconds,
    rankedResult,
    solution,
  } = location.state;

  const didWin = winnerId === mySessionId;

  const player = didWin
    ? {
        username: me.username,
        eloBefore: rankedResult.winnerEloBefore,
        eloAfter: rankedResult.winnerEloAfter,
        eloChange: rankedResult.winnerEloChange,
        mistakes: 3 - me.livesLeft,
      }
    : {
        username: me.username,
        eloBefore: rankedResult.loserEloBefore,
        eloAfter: rankedResult.loserEloAfter,
        eloChange: rankedResult.loserEloChange,
        mistakes: 3 - me.livesLeft,
      };

  const opponentResult = didWin
    ? {
        username: opponent.username,
        eloBefore: rankedResult.loserEloBefore,
        eloAfter: rankedResult.loserEloAfter,
        eloChange: rankedResult.loserEloChange,
        mistakes: 3 - opponent.livesLeft,
      }
    : {
        username: opponent.username,
        eloBefore: rankedResult.winnerEloBefore,
        eloAfter: rankedResult.winnerEloAfter,
        eloChange: rankedResult.winnerEloChange,
        mistakes: 3 - opponent.livesLeft,
      };

  const completedPuzzle = solution
    ? Array.from({ length: height }, (_, row) =>
        solution.slice(row * width, (row + 1) * width),
      )
    : [];

  const match = {
    time: fmtSeconds(displaySeconds),
    boardSize: `${width}x${height}`,
  };

  const ratingHistory = didWin
    ? rankedResult.winnerRatingHistory
    : rankedResult.loserRatingHistory;

  /*
   * ============================================================
   * GRAPH HELPERS
   * ============================================================
   */

  const graphWidth = 500;
  const graphHeight = 170;
  const graphPadding = 20;

  const minRating = Math.min(...ratingHistory) - 30;
  const maxRating = Math.max(...ratingHistory) + 30;

  const getPoint = (value: number, index: number) => {
    const x =
      ratingHistory.length === 1
        ? graphWidth / 2
        : graphPadding +
          (index / (ratingHistory.length - 1)) *
            (graphWidth - graphPadding * 2);

    const y =
      graphHeight -
      graphPadding -
      ((value - minRating) / (maxRating - minRating)) *
        (graphHeight - graphPadding * 2);

    return { x, y };
  };

  const graphPoints = ratingHistory
    .map((value: number, index: number) => {
      const point = getPoint(value, index);
      return `${point.x},${point.y}`;
    })
    .join(" ");

  const lastPoint = getPoint(
    ratingHistory[ratingHistory.length - 1],
    ratingHistory.length - 1,
  );

  const resultColour = didWin ? "#00B87C" : "#F43F5E";
  const resultBackground = didWin ? "#D1FAE5" : "#FFE4E6";

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ======================================================
          TOP BAR
          ====================================================== */}

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          background: "transparent",
          zIndex: 10,
        }}
      >
        {/* Lobby button */}

        <button
          onClick={() => navigate("/")}
          style={{
            border: "1px solid #D1D5DB",
            background: "white",
            borderRadius: 10,
            padding: "8px 14px",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-ink)",
            cursor: "pointer",
          }}
        >
          ← Main Menu
        </button>
      </div>

      {/* ======================================================
          MAIN SPLIT SCREEN
          ====================================================== */}

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "minmax(360px, 1fr) minmax(500px, 1.7fr)",
          minHeight: "100vh",
        }}
      >
        {/* ====================================================
            LEFT RESULT PANEL
            ==================================================== */}

        <div
          style={{
            background: resultBackground,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "50px 40px",
          }}
        >
          {/* Result icon */}

          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              marginBottom: 18,
            }}
          >
            {didWin ? "🏆" : "❌"}
          </div>

          {/* Result title */}

          <h1
            style={{
              margin: 0,
              fontSize: 36,
              lineHeight: 1,
              fontWeight: 800,
              color: didWin ? "#047857" : "#BE123C",
            }}
          >
            {didWin ? "Victory!" : "Defeat"}
          </h1>

          {/* Match details */}

          <div
            style={{
              marginTop: 12,
              fontSize: 14,
              fontWeight: 600,
              color: didWin ? "#059669" : "#E11D48",
            }}
          >
            Rated Match · {match.boardSize} · {match.time}
          </div>

          {/* Completed puzzle label */}

          <div
            style={{
              marginTop: 32,
              marginBottom: 12,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.12em",
              color: didWin ? "#059669" : "#E11D48",
            }}
          >
            COMPLETED PUZZLE
          </div>

          {/* ==================================================
              PICROSS BOARD
              ================================================== */}

          <div
            style={{
              width: "min(310px, 80%)",
              aspectRatio: "1",
              padding: 10,
              background: "white",
              borderRadius: 14,
              boxShadow: "0 3px 12px rgba(0,0,0,0.08)",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "grid",
                gridTemplateColumns: `repeat(${completedPuzzle.length}, 1fr)`,
                border: "1px solid #D1D5DB",
              }}
            >
              {completedPuzzle.flatMap((row, rowIndex) =>
                row.map((cell: boolean, columnIndex: number) => (
                  <div
                    key={`${rowIndex}-${columnIndex}`}
                    style={{
                      background: cell ? resultColour : "#F3F4F6",
                      borderRight:
                        columnIndex === row.length - 1
                          ? "none"
                          : "1px solid white",
                      borderBottom:
                        rowIndex === completedPuzzle.length - 1
                          ? "none"
                          : "1px solid white",
                    }}
                  />
                )),
              )}
            </div>
          </div>
        </div>

        {/* ====================================================
            RIGHT MATCH SUMMARY
            ==================================================== */}

        <div
          style={{
            background: "var(--color-paper)",
            padding: "64px clamp(32px, 5vw, 80px)",
            display: "flex",
            justifyContent: "center",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 650,
            }}
          >
            {/* Heading */}

            <h2
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 800,
                color: "var(--color-ink)",
              }}
            >
              Match Summary
            </h2>

            {/* ==================================================
                PLAYER SUMMARY CARDS
                ================================================== */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                marginTop: 20,
              }}
            >
              {/* YOU */}

              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  border: `2px solid ${didWin ? "#10B981" : "#FB7185"}`,
                  background: didWin ? "#F0FDF4" : "#FFF1F2",
                }}
              >
                {/* Name row */}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: didWin ? "#A7F3D0" : "#FECDD3",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      Y
                    </div>

                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--color-ink)",
                      }}
                    >
                      You
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: 20,
                      background: didWin ? "#10B981" : "#FB7185",
                      color: "white",
                    }}
                  >
                    {didWin ? "Winner" : "Loser"}
                  </span>
                </div>

                {/* Elo */}

                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    marginTop: 14,
                  }}
                >
                  <span
                    style={{
                      fontSize: 27,
                      fontWeight: 800,
                      color: "var(--color-ink)",
                    }}
                  >
                    {player.eloAfter}
                  </span>

                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: didWin ? "#059669" : "#E11D48",
                    }}
                  >
                    {player.eloChange > 0 ? "+" : ""}
                    {player.eloChange}
                  </span>
                </div>

                {/* Previous Elo */}

                <div
                  style={{
                    marginTop: 2,
                    fontSize: 11,
                    color: "var(--color-ink-muted)",
                  }}
                >
                  {player.eloBefore} → {player.eloAfter}
                </div>

                {/* Mistakes */}

                <div
                  style={{
                    marginTop: 12,
                    padding: "7px 9px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.7)",
                    fontSize: 11,
                    color: "var(--color-ink-muted)",
                  }}
                >
                  {player.mistakes} error
                </div>

                {/* Progress bar */}

                <div
                  style={{
                    height: 4,
                    marginTop: 10,
                    borderRadius: 10,
                    background: didWin ? "#10B981" : "#FB7185",
                    width: "100%",
                  }}
                />
              </div>

              {/* OPPONENT */}

              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  border: `2px solid ${didWin ? "#FB7185" : "#10B981"}`,
                  background: didWin ? "#FFF1F2" : "#F0FDF4",
                }}
              >
                {/* Name row */}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: didWin ? "#FECDD3" : "#A7F3D0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      S
                    </div>

                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--color-ink)",
                      }}
                    >
                      {opponentResult.username}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: 20,
                      background: didWin ? "#FB7185" : "#10B981",
                      color: "white",
                    }}
                  >
                    {didWin ? "Loser" : "Winner"}
                  </span>
                </div>

                {/* Elo */}

                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    marginTop: 14,
                  }}
                >
                  <span
                    style={{
                      fontSize: 27,
                      fontWeight: 800,
                      color: "var(--color-ink)",
                    }}
                  >
                    {opponentResult.eloAfter}
                  </span>

                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: didWin ? "#E11D48" : "#059669",
                    }}
                  >
                    {opponentResult.eloChange > 0 ? "+" : ""}
                    {opponentResult.eloChange}
                  </span>
                </div>

                {/* Previous Elo */}

                <div
                  style={{
                    marginTop: 2,
                    fontSize: 11,
                    color: "var(--color-ink-muted)",
                  }}
                >
                  {opponentResult.eloBefore} → {opponentResult.eloAfter}
                </div>

                {/* Mistakes */}

                <div
                  style={{
                    marginTop: 12,
                    padding: "7px 9px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.7)",
                    fontSize: 11,
                    color: "var(--color-ink-muted)",
                  }}
                >
                  {opponentResult.mistakes} errors
                </div>

                {/* Progress bar */}

                <div
                  style={{
                    height: 4,
                    marginTop: 10,
                    borderRadius: 10,
                    background: didWin ? "#FB7185" : "#10B981",
                    width: "100%",
                  }}
                />
              </div>
            </div>

            {/* ==================================================
                RATING HISTORY
                ================================================== */}

            <div
              style={{
                marginTop: 20,
                padding: 20,
                borderRadius: 14,
                border: "1px solid #E5E7EB",
                background: "white",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              }}
            >
              {/* Graph heading */}

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--color-ink)",
                    }}
                  >
                    Your Rating History
                  </div>

                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 11,
                      color: "var(--color-ink-muted)",
                    }}
                  >
                    Last {ratingHistory.length} games
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: "var(--color-ink)",
                    }}
                  >
                    {player.eloAfter}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: didWin ? "#059669" : "#E11D48",
                    }}
                  >
                    {player.eloChange > 0 ? "+" : ""}
                    {player.eloChange} this match
                  </div>
                </div>
              </div>

              {/* SVG Graph */}

              <svg
                viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                width="100%"
                height="170"
                preserveAspectRatio="none"
                style={{
                  display: "block",
                  marginTop: 8,
                  overflow: "visible",
                }}
              >
                {/* Horizontal grid lines */}

                {[0, 1, 2].map((line) => {
                  const y =
                    graphPadding +
                    (line / 2) * (graphHeight - graphPadding * 2);

                  return (
                    <line
                      key={line}
                      x1={graphPadding}
                      x2={graphWidth - graphPadding}
                      y1={y}
                      y2={y}
                      stroke="#E5E7EB"
                      strokeDasharray="3 4"
                    />
                  );
                })}

                {/* Rating line */}

                <polyline
                  points={graphPoints}
                  fill="none"
                  stroke={resultColour}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Last point */}

                <circle
                  cx={lastPoint.x}
                  cy={lastPoint.y}
                  r="5"
                  fill={resultColour}
                />

                <circle
                  cx={lastPoint.x}
                  cy={lastPoint.y}
                  r="9"
                  fill="none"
                  stroke={resultColour}
                  strokeOpacity="0.2"
                  strokeWidth="4"
                />
              </svg>

              {/* Graph labels */}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0 20px",
                  marginTop: -4,
                  fontSize: 10,
                  color: "var(--color-ink-muted)",
                }}
              >
                <span>{Math.round(minRating + 30)}</span>

                <span>Now</span>
              </div>
            </div>

            {/* ==================================================
                PLAY AGAIN
                ================================================== */}

            <button
              onClick={() => navigate("/multiplayer/ranked")}
              style={{
                width: "100%",
                height: 46,
                marginTop: 18,
                border: "none",
                borderRadius: 10,
                background: resultColour,
                color: "white",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                transition: "transform 0.15s ease",
              }}
              onMouseDown={(event) => {
                event.currentTarget.style.transform = "scale(0.98)";
              }}
              onMouseUp={(event) => {
                event.currentTarget.style.transform = "scale(1)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.transform = "scale(1)";
              }}
            >
              ↻ &nbsp; Play Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
