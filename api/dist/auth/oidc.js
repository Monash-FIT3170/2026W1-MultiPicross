import { discovery, allowInsecureRequests, ClientSecretBasic, ClientSecretPost, } from "openid-client";
import { env, envBool } from "../env.js";
function clientAuth() {
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
let cached = null;
export async function getOidcConfig() {
    if (!cached) {
        cached = discovery(new URL(env("OIDC_ISSUER")), env("OIDC_CLIENT_ID"), undefined, clientAuth(), envBool("OIDC_ALLOW_INSECURE")
            ? { execute: [allowInsecureRequests] }
            : undefined).catch((e) => {
            cached = null;
            throw e;
        });
    }
    return cached;
}
const REQUIRED = [
    "APP_BASE_URL",
    "OIDC_ISSUER",
    "OIDC_CLIENT_ID",
    "OIDC_CLIENT_SECRET",
    "OIDC_PROVIDER_ID",
    "OIDC_ANCHOR_CLAIM",
    "OIDC_STATE_SECRET",
];
export function assertOidcEnv() {
    if (envBool("OIDC_ALLOW_INSECURE") && env("NODE_ENV", "") === "production") {
        throw new Error("OIDC_ALLOW_INSECURE must not be set in production");
    }
    // Without this the container starts, passes its healthcheck, and only fails on
    // the first sign-in attempt.
    const missing = REQUIRED.filter((name) => !process.env[name]);
    if (missing.length > 0) {
        throw new Error(`Missing OIDC configuration: ${missing.join(", ")}`);
    }
    clientAuth();
}
export function oidcRedirectUri() {
    return `${env("APP_BASE_URL")}/api/auth/callback`;
}
export function oidcScopes() {
    return env("OIDC_SCOPES", "openid");
}
export function oidcProviderId() {
    return env("OIDC_PROVIDER_ID");
}
