/**
 * Proxy agent for Node's https.request used by openid-client (NextAuth Azure AD).
 * We attach createConnection to a real Node https.Agent instance at runtime so
 * the method is never lost to bundling (subclassing in bundled code can break).
 */

import * as net from "net";
import * as tls from "tls";
import type { Duplex } from "stream";

const PROXY_RESPONSE_END = Buffer.from("\r\n\r\n");

function parseProxyResponse(buffer: Buffer): { statusCode: number } {
  const end = buffer.indexOf(PROXY_RESPONSE_END);
  if (end === -1) throw new Error("Proxy response headers incomplete");
  const headerBlock = buffer.subarray(0, end).toString("ascii");
  const firstLine = headerBlock.split("\r\n")[0];
  const statusCode = parseInt(firstLine?.split(" ")[1] ?? "0", 10);
  return { statusCode };
}

function makeCreateConnection(proxyUrl: URL) {
  return function createConnection(
    this: unknown,
    options: tls.ConnectionOptions & { host: string; port: number },
    callback?: (err: Error | null, stream: Duplex) => void
  ): net.Socket | null {
    if (!callback) {
      throw new Error("Proxy agent requires callback form of createConnection");
    }
    const host = options.host;
    const port = options.port ?? 443;
    const isHttpsProxy = proxyUrl.protocol === "https:";
    const proxyHost = proxyUrl.hostname;
    const proxyPort = proxyUrl.port
      ? parseInt(proxyUrl.port, 10)
      : isHttpsProxy
        ? 443
        : 80;

    const connectOpts: net.TcpNetConnectOpts = {
      host: proxyHost,
      port: proxyPort,
    };

    const onProxySocket = (err: Error | null, proxySocket?: net.Socket) => {
      if (err) {
        callback(err, undefined!);
        return;
      }
      if (!proxySocket) {
        callback(new Error("No proxy socket"), undefined!);
        return;
      }

      const hostDisplay = net.isIPv6(host) ? `[${host}]` : host;
      let payload = `CONNECT ${hostDisplay}:${port} HTTP/1.1\r\nHost: ${hostDisplay}:${port}\r\n`;
      if (proxyUrl.username || proxyUrl.password) {
        const auth = `${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`;
        payload += `Proxy-Authorization: Basic ${Buffer.from(auth).toString("base64")}\r\n`;
      }
      payload += "\r\n";

      const chunks: Buffer[] = [];
      let length = 0;
      const onData = (b: Buffer) => {
        chunks.push(b);
        length += b.length;
        const full = Buffer.concat(chunks, length);
        if (full.indexOf(PROXY_RESPONSE_END) === -1) return;
        proxySocket.removeListener("data", onData);
        proxySocket.removeListener("error", onError);
        proxySocket.removeListener("end", onEnd);
        try {
          const { statusCode } = parseProxyResponse(full);
          if (statusCode !== 200) {
            proxySocket.destroy();
            callback(new Error(`Proxy CONNECT refused: ${statusCode}`), undefined!);
            return;
          }
          const tlsOpts: tls.ConnectionOptions = {
            ...options,
            socket: proxySocket,
            servername: options.servername ?? options.host,
          };
          const socket = tls.connect(tlsOpts, () => {
            callback(null, socket);
          });
          socket.on("error", (e) => callback(e, undefined!));
        } catch (e) {
          proxySocket.destroy();
          callback(e instanceof Error ? e : new Error(String(e)), undefined!);
        }
      };
      const onError = (e: Error) => {
        proxySocket.removeListener("data", onData);
        proxySocket.removeListener("end", onEnd);
        callback(e, undefined!);
      };
      const onEnd = () => {
        proxySocket.removeListener("data", onData);
        proxySocket.removeListener("error", onError);
        callback(new Error("Proxy connection closed before CONNECT response"), undefined!);
      };
      proxySocket.on("data", onData);
      proxySocket.once("error", onError);
      proxySocket.once("end", onEnd);
      proxySocket.write(payload);
    };

    if (isHttpsProxy) {
      const proxyTlsSocket = tls.connect(
        { ...connectOpts, servername: proxyHost } as tls.ConnectionOptions,
        () => onProxySocket(null, proxyTlsSocket as unknown as net.Socket)
      );
      proxyTlsSocket.on("error", (err) => callback(err, undefined!));
    } else {
      const socket = net.connect(connectOpts, () => onProxySocket(null, socket));
      socket.on("error", (err) => callback(err, undefined!));
    }
    return null;
  };
}

/**
 * Returns a Node https.Agent that tunnels through HTTP_PROXY/HTTPS_PROXY, or undefined.
 * Uses require('https') at runtime so the base Agent is always Node's native one;
 * createConnection is attached as an instance property so bundling cannot drop it.
 */
export function getProxyAgent(): import("http").Agent | undefined {
  if (typeof window !== "undefined") return undefined;
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (!proxy?.trim()) return undefined;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const https = require("https") as typeof import("https");
  const proxyUrl = new URL(proxy);
  const agent = new https.Agent();
  (agent as unknown as { createConnection: ReturnType<typeof makeCreateConnection> }).createConnection =
    makeCreateConnection(proxyUrl);
  return agent as import("http").Agent;
}
