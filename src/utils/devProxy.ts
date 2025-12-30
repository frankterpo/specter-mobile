import { Platform } from "react-native";

const DEFAULT_PROXY_PORT = 3333;

function resolveProxyHost(): string {
  const explicit = process.env.EXPO_PUBLIC_DEV_PROXY_HOST?.trim();
  if (explicit) return explicit.replace(/^https?:\/\//, "");

  // Android emulators cannot reach the host machine via localhost.
  // 10.0.2.2 maps to the host loopback on the default Android emulator.
  if (Platform.OS === "android") return "10.0.2.2";
  return "localhost";
}

function resolveProxyPort(fallback: number): number {
  const raw = process.env.EXPO_PUBLIC_DEV_PROXY_PORT;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getDevProxyOrigin(port: number = DEFAULT_PROXY_PORT): string {
  const host = resolveProxyHost();
  const resolvedPort = resolveProxyPort(port);
  return `http://${host}:${resolvedPort}`;
}

export function getDevProxyUrl(pathname: string, port: number = DEFAULT_PROXY_PORT): string {
  const origin = getDevProxyOrigin(port);
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${origin}${path}`;
}
