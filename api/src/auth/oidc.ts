import {
  discovery,
  allowInsecureRequests,
  ClientSecretBasic,
  ClientSecretPost,
  type ClientAuth,
  type Configuration,
} from "openid-client";
import { env, envBool } from "../env.js";

function clientAuth(): ClientAuth {
  const method = env("OIDC_CLIENT_AUTH", "client_secret_basic");
  const secret = env("OIDC_CLIENT_SECRET");
  switch (method) {
    case "client_secret_basic":
      return ClientSecretBasic(secret);
    case "client_secret_post":
      return ClientSecretPost(secret);
    default:
      throw new Error(`Unrecognised OIDC_CLIENT_AUTH: ${method}`);
  }
}

let cached: Promise<Configuration> | null = null;

export async function getOidcConfig(): Promise<Configuration> {
  if (!cached) {
    cached = discovery(
      new URL(env("OIDC_ISSUER")),
      env("OIDC_CLIENT_ID"),
      undefined,
      clientAuth(),
      envBool("OIDC_ALLOW_INSECURE")
        ? { execute: [allowInsecureRequests] }
        : undefined,
    ).catch((e: unknown) => {
      cached = null;
      throw e;
    });
  }
  return cached;
}

export function assertOidcEnv(): void {
  if (envBool("OIDC_ALLOW_INSECURE") && env("NODE_ENV", "") === "production") {
    throw new Error("OIDC_ALLOW_INSECURE must not be set in production");
  }
}

export function oidcRedirectUri(): string {
  return `${env("APP_BASE_URL")}/api/auth/callback`;
}

export function oidcScopes(): string {
  return env("OIDC_SCOPES", "openid");
}

export function oidcProviderId(): string {
  return env("OIDC_PROVIDER_ID");
}
