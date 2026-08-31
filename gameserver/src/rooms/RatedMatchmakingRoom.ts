import { Client, CloseCode, matchMaker, Room, ServerError } from "colyseus";
import { verifyRoomToken } from "../auth/roomToken.js";
import { requireEnv } from "../env.js";
import {
  addToRatedWaitingList,
  handleRatedQueueTimeout,
  joinRatedQueue,
  removeFromRatedWaitingList,
} from "../elo/ratedWaitingList.js";

export type AuthenticatedPlayer = {
  accountId: string;
  username: string;
};

/** How long a player waits before the Elo limit is dropped. */
const QUEUE_WAIT_TIME_MS = 30_000;

/** Ranked games are always played on the standard board. */
const RANKED_BOARD_SIZE = 10;

export class RatedMatchmakingRoom extends Room {
  maxClients = 1000;

  private readonly queueTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  // Ranked is account-only, so unlike PicrossRoom there is no guest path.
  async onAuth(
    _client: Client,
    options: { token?: string },
  ): Promise<AuthenticatedPlayer> {
    if (!options.token) {
      throw new ServerError(401, "Sign in to play ranked");
    }

    const payload = verifyRoomToken(
      options.token,
      requireEnv("JWT_ROOM_SECRET"),
    );
    if (!payload) {
      throw new ServerError(401, "Invalid or expired room token");
    }

    return { accountId: payload.sub, username: payload.username };
  }

  onCreate(): void {
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

  async onLeave(client: Client, _code: CloseCode): Promise<void> {
    const player = client.auth as AuthenticatedPlayer;

    this.clearQueueTimer(player.accountId);
    await removeFromRatedWaitingList(player.accountId);
  }

  onDispose(): void {
    for (const timer of this.queueTimers.values()) {
      clearTimeout(timer);
    }

    this.queueTimers.clear();
  }

  /*
  Rows can outlive their client after a crash, and a client in another
  instance of this room is one we cannot hand a match to. Matching only
  against accounts connected here keeps both out of the running.
  */
  private isConnected = (accountId: string): boolean => {
    return this.findClientByAccountId(accountId) !== undefined;
  };

  private async handleJoinQueue(client: Client): Promise<void> {
    const player = client.auth as AuthenticatedPlayer;
    const result = await joinRatedQueue(player.accountId, this.isConnected);

    if (result.status === "queued") {
      this.sendQueued(client);
      return;
    }

    const opponentClient = this.findClientByAccountId(
      result.opponent.accountId,
    );

    /*
    The opponent was connected when the queue was read and has since left.
    Their row is already claimed, so re-queue both rather than dropping them.
    */
    if (!opponentClient) {
      await addToRatedWaitingList(result.opponent.accountId);
      await addToRatedWaitingList(player.accountId);
      this.sendQueued(client);
      return;
    }

    await this.createGameForPlayers(client, opponentClient);
  }

  private async handleStayInQueue(client: Client): Promise<void> {
    const player = client.auth as AuthenticatedPlayer;

    await addToRatedWaitingList(player.accountId);
    this.sendQueued(client);
  }

  private async handleLeaveQueue(client: Client): Promise<void> {
    const player = client.auth as AuthenticatedPlayer;

    this.clearQueueTimer(player.accountId);
    await removeFromRatedWaitingList(player.accountId);

    client.send("queueStatus", { status: "left" });
  }

  private async handleQueueTimeout(client: Client): Promise<void> {
    const player = client.auth as AuthenticatedPlayer;

    this.queueTimers.delete(player.accountId);

    const result = await handleRatedQueueTimeout(
      player.accountId,
      this.isConnected,
    );

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

    if (!opponentClient) {
      await addToRatedWaitingList(result.opponent.accountId);
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

  private sendQueued(client: Client): void {
    client.send("queueStatus", { status: "queued" });
    this.startQueueTimer(client);
  }

  /*
  The timeout leaves the player queued, so the client has to answer with
  stayInQueue or leaveQueue rather than simply stopping its spinner.
  */
  private sendQueueTimeoutEmpty(client: Client): void {
    client.send("queueTimeoutEmpty", {
      message:
        "No one else is in the queue at the moment. Would you like to keep waiting?",
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

    let gameRoom;
    try {
      // Private so the pair's room never surfaces in the public lobby.
      gameRoom = await matchMaker.createRoom("picross_room", {
        width: RANKED_BOARD_SIZE,
        height: RANKED_BOARD_SIZE,
        isPublic: false,
      });
    } catch (err) {
      console.error("ranked create-room error", err);

      // Both rows are already claimed, so put them back and let the pair wait.
      await addToRatedWaitingList(firstPlayer.accountId);
      await addToRatedWaitingList(secondPlayer.accountId);
      this.sendQueued(firstClient);
      this.sendQueued(secondClient);
      return;
    }

    const matchMessage = { roomId: gameRoom.roomId };

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
