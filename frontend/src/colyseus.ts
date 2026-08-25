import { Client } from "@colyseus/sdk";

/**
 * Base URL of the gameserver. Traefik routes /gs/* → gameserver:2567 with the
 * prefix stripped (see compose.yaml). Written once here and exported so the
 * plain fetches against the room HTTP endpoints build on the same value as the
 * Colyseus client below — the prefix used to be spelled out in two files and
 * would have drifted if the route ever changed.
 */
export const GAMESERVER_BASE_URL = `${window.location.protocol}//${window.location.host}/gs`;

export const gameserverClient = new Client(GAMESERVER_BASE_URL);
