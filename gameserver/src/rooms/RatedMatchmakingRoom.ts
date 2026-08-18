import { JWT } from "@colyseus/auth";
import {
  Client,
  CloseCode,
  matchMaker,
  Room,
  type AuthContext,
} from "colyseus";

type AccessTokenPayload = {
  sub: string;
  username: string;
  type: string;
  exp: number;
};

export type AuthenticatedPlayer = {
  accountId: string;
  username: string;
};

const QUEUE_WAIT_TIME_MS = 60_000;

function getAccessToken(cookieHeader: string): string | undefined {
  const accessTokenCookie = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("access_token="));

  if (!accessTokenCookie) {
    return undefined;
  }

  return decodeURIComponent(accessTokenCookie.slice("access_token=".length));
}

export class RatedMatchmakingRoom extends Room {
  maxClients = 1000;

  private readonly queueTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  static async onAuth(
    _token: string,
    _options: unknown,
    context: AuthContext,
  ): Promise<AuthenticatedPlayer> {
    const jwtSecret = process.env.JWT_ACCESS_SECRET;

    if (!jwtSecret) {
      throw new Error("JWT_ACCESS_SECRET must be set");
    }

    JWT.settings.secret = jwtSecret;

    const cookieHeader = context.headers.get("cookie") ?? "";
    const accessToken = getAccessToken(cookieHeader);

    if (!accessToken) {
      throw new Error("Authentication required");
    }

    const payload = await JWT.verify<AccessTokenPayload>(accessToken);

    if (!payload.sub || !payload.username || payload.type !== "access") {
      throw new Error("Invalid access token");
    }

    return {
      accountId: payload.sub,
      username: payload.username,
    };
  }

  onCreate(): void {
    console.log("Rated matchmaking room created");

    this.onMessage("joinQueue", (client) => {
      void this.handleJoinQueue(client);
    });
  }

  onJoin(client: Client): void {
    const player = client.auth as AuthenticatedPlayer;

    console.log(
      `${player.username} (${player.accountId}) joined rated matchmaking`,
    );
  }

  async onLeave(client: Client, _code: CloseCode): Promise<void> {
    const player = client.auth as AuthenticatedPlayer;

    this.clearQueueTimer(player.accountId);

    /*
    The database module is imported only when a player actually leaves.
    This prevents ordinary room tests from requiring database environment
    variables when the matchmaking room is merely loaded.
    */
    const { removeFromRatedWaitingList } =
      await import("../elo/ratedWaitingList.js");

    await removeFromRatedWaitingList(player.accountId);

    console.log(
      `${player.username} (${player.accountId}) left rated matchmaking`,
    );
  }

  onDispose(): void {
    for (const timer of this.queueTimers.values()) {
      clearTimeout(timer);
    }

    this.queueTimers.clear();
    console.log("Rated matchmaking room disposed");
  }

  private async handleJoinQueue(client: Client): Promise<void> {
    const player = client.auth as AuthenticatedPlayer;

    /*
    Lazy loading prevents the database client from being initialised
    until matchmaking is actually requested.
    */
    const { addToRatedWaitingList, joinRatedQueue } =
      await import("../elo/ratedWaitingList.js");

    const result = await joinRatedQueue(player.accountId);

    if (result.status === "queued") {
      client.send("queueStatus", {
        status: "queued",
      });

      this.startQueueTimer(client);
      return;
    }

    const opponentClient = this.clients.find((waitingClient) => {
      const waitingPlayer = waitingClient.auth as AuthenticatedPlayer;

      return waitingPlayer.accountId === result.opponent.accountId;
    });

    /*
    A database entry could remain after a server restart or an unexpected
    disconnect. If the opponent is no longer connected, queue this player
    instead of creating a match with a missing client.
    */
    if (!opponentClient) {
      await addToRatedWaitingList(player.accountId);

      client.send("queueStatus", {
        status: "queued",
      });

      this.startQueueTimer(client);
      return;
    }

    this.clearQueueTimer(player.accountId);
    this.clearQueueTimer(result.opponent.accountId);

    const gameRoom = await matchMaker.createRoom("my_room", {
      playerOneAccountId: player.accountId,
      playerTwoAccountId: result.opponent.accountId,
    });

    const matchMessage = {
      roomId: gameRoom.roomId,
    };

    client.send("matched", matchMessage);
    opponentClient.send("matched", matchMessage);
  }

  private startQueueTimer(client: Client): void {
    const player = client.auth as AuthenticatedPlayer;

    this.clearQueueTimer(player.accountId);

    const timer = setTimeout(() => {
      client.send("queueTimerExpired");
      this.queueTimers.delete(player.accountId);
    }, QUEUE_WAIT_TIME_MS);

    this.queueTimers.set(player.accountId, timer);
  }

  private clearQueueTimer(accountId: string): void {
    const timer = this.queueTimers.get(accountId);

    if (timer) {
      clearTimeout(timer);
    }

    this.queueTimers.delete(accountId);
  }
}
