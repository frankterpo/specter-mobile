export function getJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadB64.padEnd(payloadB64.length + ((4 - (payloadB64.length % 4)) % 4), "=");
    const json = base64Decode(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function base64Decode(input: string): string {
  const atobFn = (globalThis as any).atob as ((s: string) => string) | undefined;
  if (typeof atobFn === "function") return atobFn(input);

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < input.length; i++) {
    const c = input.charAt(i);
    if (c === "=") break;
    const value = chars.indexOf(c);
    if (value === -1) continue;

    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

export function getJwtSub(token: string): string | null {
  const payload = getJwtPayload(token);
  return typeof payload?.sub === "string" ? payload.sub : null;
}

export function getJwtExpMs(token: string): number | null {
  const payload = getJwtPayload(token);
  if (typeof payload?.exp !== "number") return null;
  return payload.exp * 1000;
}
