import { hash, verify as argon2Verify } from "@node-rs/argon2";
import { sign, verify as jwtVerify } from "hono/jwt";
import { createHash } from "node:crypto";
import { env } from "../env.js";
const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const ROOM_TTL_SECONDS = 60;
export async function hashPassword(plain) {
    return hash(plain);
}
export async function verifyPassword(plain, storedHash) {
    return argon2Verify(storedHash, plain);
}
export async function signAccessToken(payload) {
    return sign({
        ...payload,
        type: "access",
        exp: Math.floor(Date.now() / 1000) + ACCESS_TTL_SECONDS,
    }, env("JWT_ACCESS_SECRET"));
}
export async function signRoomToken(payload) {
    return sign({
        ...payload,
        type: "room",
        exp: Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS,
    }, env("JWT_ACCESS_SECRET"));
}
export async function signRefreshToken(payload) {
    return sign({
        ...payload,
        type: "refresh",
        exp: Math.floor(Date.now() / 1000) + REFRESH_TTL_SECONDS,
    }, env("JWT_REFRESH_SECRET"));
}
export async function verifyRefreshToken(token) {
    const payload = await jwtVerify(token, env("JWT_REFRESH_SECRET"), "HS256");
    return payload;
}
export function hashToken(rawToken) {
    return createHash("sha256").update(rawToken).digest("hex");
}
export function refreshExpiresAt() {
    return new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
}
