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

    this.onMessage("stayInQueue", (client) => {
      void this.handleStayInQueue(client);
    });

    this.onMessage("leaveQueue", (client) => {
      void this.handleLeaveQueue(client);
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

    const opponentClient = this.findClientByAccountId(
      result.opponent.accountId,
    );

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

    await this.createGameForPlayers(client, opponentClient);
  }

  private async handleStayInQueue(client: Client): Promise<void> {
    const player = client.auth as AuthenticatedPlayer;

    const { addToRatedWaitingList } =
      await import("../elo/ratedWaitingList.js");

    /*
    Adding is idempotent, so the player will not be duplicated if they
    are still present in the waiting list.
    */
    await addToRatedWaitingList(player.accountId);

    client.send("queueStatus", {
      status: "queued",
    });

    this.startQueueTimer(client);
  }

  private async handleLeaveQueue(client: Client): Promise<void> {
    const player = client.auth as AuthenticatedPlayer;

    this.clearQueueTimer(player.accountId);

    const { removeFromRatedWaitingList } =
      await import("../elo/ratedWaitingList.js");

    await removeFromRatedWaitingList(player.accountId);

    client.send("queueStatus", {
      status: "left",
    });
  }

  private async handleQueueTimeout(client: Client): Promise<void> {
    const player = client.auth as AuthenticatedPlayer;

    this.queueTimers.delete(player.accountId);

    const { addToRatedWaitingList, handleRatedQueueTimeout } =
      await import("../elo/ratedWaitingList.js");

    const result = await handleRatedQueueTimeout(player.accountId);

    if (result.status === "not-queued") {
      return;
    }

    if (result.status === "waiting-alone") {
      this.sendQueueTimeoutEmpty(client);
      return;
    }

    const opponentClient = this.findClientByAccountId(
      result.opponent.accountId,
    );

    /*
    If the closest database entry belongs to a disconnected player,
    keep the current player queued and ask them whether they want to
    continue waiting.
    */
    if (!opponentClient) {
      await addToRatedWaitingList(player.accountId);
      this.sendQueueTimeoutEmpty(client);
      return;
    }

    await this.createGameForPlayers(client, opponentClient);
  }

  private findClientByAccountId(accountId: string): Client | undefined {
    return this.clients.find((waitingClient) => {
      const waitingPlayer = waitingClient.auth as AuthenticatedPlayer;

      return waitingPlayer.accountId === accountId;
    });
  }

  private sendQueueTimeoutEmpty(client: Client): void {
    client.send("queueTimeoutEmpty", {
      message:
        "No one else is in the queue at the moment. Would you like to wait another minute?",
    });
  }

  private async createGameForPlayers(
    firstClient: Client,
    secondClient: Client,
  ): Promise<void> {
    const firstPlayer = firstClient.auth as AuthenticatedPlayer;
    const secondPlayer = secondClient.auth as AuthenticatedPlayer;

    this.clearQueueTimer(firstPlayer.accountId);
    this.clearQueueTimer(secondPlayer.accountId);

    const gameRoom = await matchMaker.createRoom("my_room", {
      playerOneAccountId: firstPlayer.accountId,
      playerTwoAccountId: secondPlayer.accountId,
    });

    const matchMessage = {
      roomId: gameRoom.roomId,
    };

    firstClient.send("matched", matchMessage);
    secondClient.send("matched", matchMessage);
  }

  private startQueueTimer(client: Client): void {
    const player = client.auth as AuthenticatedPlayer;

    this.clearQueueTimer(player.accountId);

    const timer = setTimeout(() => {
      void this.handleQueueTimeout(client);
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
