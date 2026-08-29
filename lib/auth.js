// functions/lib/auth.js
// Utility untuk hashing password (PBKDF2-SHA256) dan session token (HMAC-SHA256),
// pakai Web Crypto API supaya jalan native di Cloudflare Pages Functions.

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

const PBKDF2_ITERATIONS = 100000;

export async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return `${toHex(salt)}:${toHex(derivedBits)}`;
}

export async function verifyPassword(password, stored) {
  const [saltHex] = stored.split(":");
  const computed = await hashPassword(password, saltHex);
  return computed === stored;
}

async function hmac(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toHex(sig);
}

// Session token sederhana: base64(payload) + "." + HMAC(payload)
// payload = username|role|kabkotaKode|expiryTimestamp|originUsername|originRole
// kabkotaKode kosong ("") untuk role admin_provinsi/super_admin (tidak terikat satu kabkota).
// originUsername/originRole terisi HANYA kalau sesi ini hasil "masuk sebagai" dari super_admin
// (dipakai tombol "Kembali ke Super Admin" supaya tidak perlu login ulang).
export async function createSessionToken(username, role, kabkotaKode, secret, ttlSeconds = 60 * 60 * 12, originUsername = "", originRole = "") {
  const expiry = Date.now() + ttlSeconds * 1000;
  const payload = `${username}|${role}|${kabkotaKode || ""}|${expiry}|${originUsername}|${originRole}`;
  const sig = await hmac(secret, payload);
  return `${btoa(payload)}.${sig}`;
}

export async function verifySessionToken(token, secret) {
  try {
    const [payloadB64, sig] = token.split(".");
    const payload = atob(payloadB64);
    const expectedSig = await hmac(secret, payload);
    if (expectedSig !== sig) return null;

    const [username, role, kabkotaKode, expiryStr, originUsername, originRole] = payload.split("|");
    const expiry = Number(expiryStr);
    if (Date.now() > expiry) return null;

    return { username, role, kabkotaKode: kabkotaKode || null, originUsername: originUsername || null, originRole: originRole || null };
  } catch {
    return null;
  }
}
