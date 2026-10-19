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
    colors,
    forfeit,
  } = location.state;

  const noWinner = !winnerId;
  const didWin = !noWinner && winnerId === mySessionId;

  const isDoubleElimination = rankedResult?.resultType === "double-elimination";

  const playerWon = didWin && !isDoubleElimination;
  const opponentWon = !didWin && !isDoubleElimination && !noWinner;

  const opponentAbandoned = forfeit === true;

  let player;
  let opponentResult;
  let ratingHistory: number[];

  if (isDoubleElimination) {
    const iAmPlayerOne = mySessionId === rankedResult.playerOneSessionId;

    player = iAmPlayerOne
      ? {
          username: me.username,
          eloBefore: rankedResult.playerOneEloBefore,
          eloAfter: rankedResult.playerOneEloAfter,
          eloChange: rankedResult.playerOneEloChange,
          mistakes: 3 - me.livesLeft,
        }
      : {
          username: me.username,
          eloBefore: rankedResult.playerTwoEloBefore,
          eloAfter: rankedResult.playerTwoEloAfter,
          eloChange: rankedResult.playerTwoEloChange,
          mistakes: 3 - me.livesLeft,
        };

    opponentResult = iAmPlayerOne
      ? {
          username: opponent.username,
          eloBefore: rankedResult.playerTwoEloBefore,
          eloAfter: rankedResult.playerTwoEloAfter,
          eloChange: rankedResult.playerTwoEloChange,
          mistakes: 3 - opponent.livesLeft,
        }
      : {
          username: opponent.username,
          eloBefore: rankedResult.playerOneEloBefore,
          eloAfter: rankedResult.playerOneEloAfter,
          eloChange: rankedResult.playerOneEloChange,
          mistakes: 3 - opponent.livesLeft,
        };

    ratingHistory = iAmPlayerOne
      ? rankedResult.playerOneRatingHistory
      : rankedResult.playerTwoRatingHistory;
  } else {
    player = didWin
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

    opponentResult = didWin
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

    ratingHistory = didWin
      ? rankedResult.winnerRatingHistory
      : rankedResult.loserRatingHistory;
  }

  const completedPuzzle = solution
    ? Array.from({ length: height }, (_, row) =>
        solution.slice(row * width, (row + 1) * width),
      )
    : [];

  const match = {
    time: fmtSeconds(displaySeconds),
    boardSize: `${width}x${height}`,
  };

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

  /*
   * ============================================================
   * THEME-AWARE RESULT COLOURS
   * ============================================================
   */

  const resultColour = playerWon
    ? "var(--color-result-win)"
    : "var(--color-result-loss)";

  const resultBackground = playerWon
    ? "var(--color-result-win-background)"
    : "var(--color-result-loss-background)";

  const winColour = "var(--color-result-win)";
  const lossColour = "var(--color-result-loss)";

  const playerColour = playerWon ? winColour : lossColour;
  const opponentColour = opponentWon ? winColour : lossColour;

  const playerBackground = playerWon
    ? "var(--color-result-win-background)"
    : "var(--color-result-loss-background)";

  const opponentBackground = opponentWon
    ? "var(--color-result-win-background)"
    : "var(--color-result-loss-background)";

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
        background: "var(--color-paper)",
        color: "var(--color-ink)",
      }}
    >
      {/* TOP BAR */}

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
        <button
          onClick={() => navigate("/")}
          style={{
            border: "1px solid var(--color-line)",
            background: "var(--color-surface)",
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

      {/* MAIN SPLIT SCREEN */}

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "minmax(360px, 1fr) minmax(500px, 1.7fr)",
          minHeight: "100vh",
        }}
      >
        {/* LEFT RESULT PANEL */}

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
              background: "var(--color-surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              boxShadow: "0 2px 8px var(--color-line)",
              marginBottom: 18,
            }}
          >
            {noWinner ? "⚔️" : didWin ? "🏆" : "❌"}
          </div>

          {/* Result title */}

          <h1
            style={{
              margin: 0,
              fontSize: isDoubleElimination ? 30 : 36,
              lineHeight: 1.2,
              fontWeight: 800,
              color: isDoubleElimination
                ? lossColour
                : didWin
                  ? winColour
                  : lossColour,
              textAlign: "center",
              width: "100%",
            }}
          >
            {isDoubleElimination
              ? "Double Elimination"
              : didWin
                ? "Victory!"
                : "Defeat"}
          </h1>

          {/* Match details */}

          <div
            style={{
              marginTop: 12,
              fontSize: 14,
              fontWeight: 600,
              color: didWin ? winColour : lossColour,
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
              color: didWin ? winColour : lossColour,
            }}
          >
            COMPLETED PUZZLE
          </div>

          {/* PICROSS BOARD */}

          <div
            style={{
              width: "min(310px, 80%)",
              aspectRatio: "1",
              padding: 10,
              background: "var(--color-surface)",
              borderRadius: 14,
              boxShadow: "0 3px 12px var(--color-line)",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "grid",
                gridTemplateColumns: `repeat(${completedPuzzle.length}, 1fr)`,
                border: "1px solid var(--color-line)",
              }}
            >
              {completedPuzzle.flatMap((row, rowIndex) =>
                row.map((cell: boolean, columnIndex: number) => (
                  <div
                    key={`${rowIndex}-${columnIndex}`}
                    style={{
                      background:
                        colors?.[rowIndex * width + columnIndex] ??
                        (cell
                          ? "var(--color-ink)"
                          : "var(--color-surface-sunk)"),
                      borderRight:
                        columnIndex === row.length - 1
                          ? "none"
                          : "1px solid var(--color-line)",
                      borderBottom:
                        rowIndex === completedPuzzle.length - 1
                          ? "none"
                          : "1px solid var(--color-line)",
                    }}
                  />
                )),
              )}
            </div>
          </div>
        </div>

        {/* RIGHT MATCH SUMMARY */}

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

            {/* PLAYER SUMMARY CARDS */}

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
                  border: `2px solid ${playerColour}`,
                  background: playerBackground,
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
                        background: "var(--color-surface)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 800,
                        color: "var(--color-ink)",
                        border: "1px solid var(--color-line)",
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
                      background: isDoubleElimination
                        ? lossColour
                        : playerWon
                          ? winColour
                          : lossColour,
                      color: "var(--color-paper)",
                    }}
                  >
                    {isDoubleElimination
                      ? "Eliminated"
                      : playerWon
                        ? "Winner"
                        : "Loser"}
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
                      color: playerColour,
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
                    background: "var(--color-surface)",
                    fontSize: 11,
                    color: "var(--color-ink-muted)",
                  }}
                >
                  {player.mistakes} {player.mistakes === 1 ? "error" : "errors"}
                </div>

                {/* Progress bar */}

                <div
                  style={{
                    height: 4,
                    marginTop: 10,
                    borderRadius: 10,
                    background: playerColour,
                    width: "100%",
                  }}
                />
              </div>

              {/* OPPONENT */}

              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  border: `2px solid ${opponentColour}`,
                  background: opponentBackground,
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
                        background: "var(--color-surface)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 800,
                        color: "var(--color-ink)",
                        border: "1px solid var(--color-line)",
                      }}
                    >
                      {opponentResult.username?.charAt(0).toUpperCase() || "?"}
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
                      background: isDoubleElimination
                        ? lossColour
                        : opponentWon
                          ? winColour
                          : lossColour,
                      color: "var(--color-paper)",
                    }}
                  >
                    {isDoubleElimination
                      ? "Eliminated"
                      : opponentAbandoned
                        ? "Abandoned"
                        : opponentWon
                          ? "Winner"
                          : "Loser"}
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
                      color: opponentColour,
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
                    background: "var(--color-surface)",
                    fontSize: 11,
                    color: "var(--color-ink-muted)",
                  }}
                >
                  {opponentResult.mistakes}{" "}
                  {opponentResult.mistakes === 1 ? "error" : "errors"}
                </div>

                {/* Progress bar */}

                <div
                  style={{
                    height: 4,
                    marginTop: 10,
                    borderRadius: 10,
                    background: opponentColour,
                    width: "100%",
                  }}
                />
              </div>
            </div>

            {/* RATING HISTORY */}

            <div
              style={{
                marginTop: 20,
                padding: 20,
                borderRadius: 14,
                border: "1px solid var(--color-line)",
                background: "var(--color-surface)",
                boxShadow: "0 2px 8px var(--color-line)",
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
                      color: playerColour,
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
                      stroke="var(--color-line)"
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

            {/* PLAY AGAIN */}

            <button
              onClick={() => navigate("/multiplayer/competitive")}
              style={{
                width: "100%",
                height: 46,
                marginTop: 18,
                border: "none",
                borderRadius: 10,
                background: resultColour,
                color: "var(--color-paper)",
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
