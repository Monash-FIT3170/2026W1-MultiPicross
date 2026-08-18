import { Client } from "@colyseus/sdk";

// Routes through Traefik: /gs/* → gameserver:2567 (prefix stripped)
export const gameserverClient = new Client(
  `${window.location.protocol}//${window.location.host}/gs`,
);
