/**
 * The live game connection: CometD over WebSocket, falling back to long polling when a school network
 * blocks WebSocket. The Ack extension makes sure every message arrives after a short drop; TimeSync
 * measures this device's clock offset and network lag, which the server uses for fair speed points.
 * Kept behind this small interface so the transport can change (the architecture's fallback plan).
 */
export type LiveMessage = Record<string, unknown> & { type: string };
export type LiveStatus = "connecting" | "connected" | "reconnecting" | "failed";

export interface LiveConnection {
  send(data: Record<string, unknown>): void;
  /** Now, on the game server's clock. */
  serverNow(): number;
  transport(): string;
  close(): void;
}

interface Options {
  url: string;
  pin: string;
  ticket: string;
  role: "host" | "player";
  onMessage(message: LiveMessage): void;
  onStatus(status: LiveStatus, message?: string): void;
}

export async function connectLive(opts: Options): Promise<LiveConnection> {
  const { CometD, AckExtension, TimeSyncExtension } = await import("cometd");
  const cometd = new CometD();
  const timesync = new TimeSyncExtension() as unknown as { getTimeOffset(): number };
  cometd.registerExtension("ack", new AckExtension());
  cometd.registerExtension("timesync", timesync as never);
  cometd.configure({ url: opts.url, logLevel: "warn", maxNetworkDelay: 15000, stickyReconnect: true });

  const service = opts.role === "host" ? "/service/controller" : "/service/player";
  const privateChannel = opts.role === "host" ? `/game/${opts.pin}/host` : `/game/${opts.pin}/me`;
  let closed = false;
  let wasConnected = false;

  cometd.addListener(privateChannel, (m) => opts.onMessage(m.data as LiveMessage));

  // Runs on the first handshake and on every automatic re-handshake (e.g. after the server restarted):
  // subscriptions are made again and the device announces itself, so the game resumes where it was.
  cometd.addListener("/meta/handshake", (m) => {
    if (closed) return;
    if (!m.successful) {
      opts.onStatus("failed", "This game has ended, or your pass to it has expired. Go back and enter the PIN again.");
      closed = true;
      cometd.disconnect();
      return;
    }
    if (opts.role === "player") {
      cometd.subscribe(`/game/${opts.pin}/players`, (msg) => opts.onMessage(msg.data as LiveMessage));
    }
    cometd.publish(service, { type: opts.role === "host" ? "hello" : "join" });
  });

  cometd.addListener("/meta/connect", (m) => {
    if (closed) return;
    if (m.successful) {
      if (!wasConnected) opts.onStatus("connected");
      wasConnected = true;
    } else if (wasConnected) {
      wasConnected = false;
      opts.onStatus("reconnecting", "Connection lost. Reconnecting…");
    }
  });

  opts.onStatus("connecting");
  cometd.handshake({ ext: { isquiz: { ticket: opts.ticket } } });

  return {
    send: (data) => cometd.publish(service, data),
    serverNow: () => Date.now() + (timesync.getTimeOffset?.() ?? 0),
    transport: () => cometd.getTransport()?.type ?? "",
    close: () => {
      closed = true;
      cometd.disconnect();
    },
  };
}
