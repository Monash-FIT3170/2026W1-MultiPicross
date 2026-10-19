import { sign, verify } from "hono/jwt";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { env } from "../env.js";
const secure = process.env.NODE_ENV === "production";
const TX_PATH = "/api/auth/callback";
const TX_TTL_SECONDS = 600;
// The state (not a fixed cookie name) identifies the transaction, so concurrent login tabs don't clobber each other.
function txCookieName(state) {
    return `oidc_tx_${state}`;
}
export async function setOidcTx(c, state, tx) {
    const token = await sign({
        v: tx.v,
        n: tx.n,
        r: tx.r,
        type: "oidc_tx",
        exp: Math.floor(Date.now() / 1000) + TX_TTL_SECONDS,
    }, env("OIDC_STATE_SECRET"));
    setCookie(c, txCookieName(state), token, {
        httpOnly: true,
        sameSite: "Lax",
        secure,
        path: TX_PATH,
        maxAge: TX_TTL_SECONDS,
    });
}
export async function takeOidcTx(c, state) {
    const name = txCookieName(state);
    const token = getCookie(c, name);
    if (!token)
        return null;
    try {
        const payload = await verify(token, env("OIDC_STATE_SECRET"), "HS256");
        if (payload.type !== "oidc_tx")
            return null;
        const { v, n, r } = payload;
        if (typeof v !== "string" || typeof n !== "string" || typeof r !== "string")
            return null;
        return { v, n, r };
    }
    catch {
        return null;
    }
    finally {
        deleteCookie(c, name, { path: TX_PATH });
    }
}
