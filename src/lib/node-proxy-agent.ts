/**
 * A proxy agent that extends Node's native https.Agent so it has getName() and
 * is accepted by Node's http(s).request. openid-client (used by NextAuth) passes
 * the agent to https.request(); passing agent-base-based agents can cause
 * "this.getName is not a function" because Node expects a real http.Agent.
 *
 * This class extends https.Agent and overrides createConnection to tunnel
 * through an HTTP(S) proxy via CONNECT.
 */

import * as net from "net";
import * as tls from "tls";
import * as https from "https";
import type { Duplex } from "stream";
import { URL } from "url";

const PROXY_RESPONSE_END = Buffer.from("\r\n\r\n");

function parseProxyResponse(buffer: Buffer): { statusCode: number; buffered: Buffer } {
  const end = buffer.indexOf(PROXY_RESPONSE_END);
  if (end === -1) throw new Error("Proxy response headers incomplete");
  const headerBlock = buffer.subarray(0, end).toString("ascii");
  const firstLine = headerBlock.split("\r\n")[0];
  const statusCode = parseInt(firstLine?.split(" ")[1] ?? "0", 10);
  return { statusCode, buffered: buffer };
}

export class NodeHttpsProxyAgent extends https.Agent {
  private proxyUrl: URL;

  constructor(proxy: string | URL, agentOptions?: https.AgentOptions) {
    super(agentOptions);
    this.proxyUrl = typeof proxy === "string" ? new URL(proxy) : proxy;
  }

  override createConnection(
    options: tls.ConnectionOptions & { host: string; port: number },
    callback?: (err: Error | null, stream: Duplex) => void
  ): net.Socket | null {
    if (!callback) {
      throw new Error("NodeHttpsProxyAgent requires callback form of createConnection");
    }
    const proxyUrl = this.proxyUrl;
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
          const { statusCode, buffered } = parseProxyResponse(full);
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
      const proxyTlsSocket = tls.connect({
        ...connectOpts,
        servername: proxyHost,
      } as tls.ConnectionOptions, () => {
        onProxySocket(null, proxyTlsSocket as unknown as net.Socket);
      });
      proxyTlsSocket.on("error", (err) => callback(err, undefined!));
    } else {
      const socket = net.connect(connectOpts, () => {
        onProxySocket(null, socket);
      });
      socket.on("error", (err) => callback(err, undefined!));
    }
    return null; // connection is established asynchronously via callback
  }
}

/**
 * Returns an agent that tunnels HTTPS through the proxy, or undefined if no proxy is set.
 * Use this for openid-client / NextAuth httpOptions.agent so Node never receives
 * a non-Agent (avoids "this.getName is not a function").
 */
export function getProxyAgent(): NodeHttpsProxyAgent | undefined {
  if (typeof window !== "undefined") return undefined;
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (!proxy?.trim()) return undefined;
  return new NodeHttpsProxyAgent(proxy);
}
