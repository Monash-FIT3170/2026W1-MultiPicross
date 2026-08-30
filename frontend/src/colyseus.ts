import { Client } from "@colyseus/sdk";

// Base URL of the gameserver. Traefik routes /gs/* → gameserver:2567 with the
// prefix stripped. Exported so the room HTTP fetches and the Colyseus client
// below cannot spell the prefix differently.
export const GAMESERVER_BASE_URL = `${window.location.protocol}//${window.location.host}/gs`;

export const gameserverClient = new Client(GAMESERVER_BASE_URL);
