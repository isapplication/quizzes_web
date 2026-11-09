import { describe, expect, it } from "vitest";
import { chosenTune, DEFAULT_LOBBY_VOLUME, lobbyLength, lobbyLevel, LOBBY_TUNES, parseLobbyMusic } from "../../lib/gameSound";

describe("lobby music: the host's choice", () => {
  it("offers the four family tunes and no music", () => {
    expect(LOBBY_TUNES.map((t) => t.value)).toEqual(["k2", "e35", "m68", "h912", "off"]);
  });

  it("plays the game's own family tune until the host chooses", () => {
    expect(chosenTune({ tune: null, volume: 70 }, "m68")).toBe("m68");
    expect(chosenTune({ tune: "h912", volume: 70 }, "k2")).toBe("h912");
    expect(chosenTune({ tune: "off", volume: 70 }, "k2")).toBe("off");
  });

  it("reads what was kept on the device", () => {
    expect(parseLobbyMusic(JSON.stringify({ tune: "e35", volume: 40 }))).toEqual({ tune: "e35", volume: 40 });
    expect(parseLobbyMusic(JSON.stringify({ tune: "off", volume: 0 }))).toEqual({ tune: "off", volume: 0 });
  });

  it("falls back to the defaults for anything unreadable, and keeps the volume in range", () => {
    const none = { tune: null, volume: DEFAULT_LOBBY_VOLUME };
    expect(parseLobbyMusic(null)).toEqual(none);
    expect(parseLobbyMusic("")).toEqual(none);
    expect(parseLobbyMusic("not json")).toEqual(none);
    expect(parseLobbyMusic(JSON.stringify({ tune: "polka", volume: "loud" }))).toEqual(none);
    expect(parseLobbyMusic(JSON.stringify({ tune: "k2", volume: 250 }))).toEqual({ tune: "k2", volume: 100 });
    expect(parseLobbyMusic(JSON.stringify({ tune: "k2", volume: -5 }))).toEqual({ tune: "k2", volume: 0 });
  });

  it("turns the volume control into a gain that never exceeds the family's usual level", () => {
    expect(lobbyLevel(100)).toBe(1);
    expect(lobbyLevel(0)).toBe(0);
    expect(lobbyLevel(50)).toBeCloseTo(0.25);
    expect(lobbyLevel(300)).toBe(1);
    expect(lobbyLevel(-10)).toBe(0);
  });

  it("repeats each tune after one pass", () => {
    expect(lobbyLength("h912")).toBeGreaterThan(lobbyLength("k2"));
  });
});
