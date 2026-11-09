import { createElement } from "react";
import { CHARACTERS, isCharacter, slotColor } from "@/lib/characters";

/**
 * A player's built-in character (lib/characters.ts), drawn as inline SVG in the school's theme colours. Decoration only:
 * the player's name is always written beside it, so it is hidden from screen readers. Draws nothing for no character.
 */
export function CharacterAvatar({ character, size = 40, className }: {
  character: number | null | undefined;
  size?: number;
  className?: string;
}) {
  if (!isCharacter(character)) return null;
  return (
    <svg className={"gl-char" + (className ? " " + className : "")} viewBox="0 0 64 64" width={size} height={size}
         aria-hidden="true" focusable="false">
      {CHARACTERS[character].pieces.map((piece, i) => createElement(piece.tag, {
        key: i,
        ...piece.attrs,
        fill: piece.fill ? slotColor(piece.fill) : "none",
        stroke: piece.stroke ? slotColor(piece.stroke) : undefined,
        strokeWidth: piece.stroke ? (piece.width ?? 2) : undefined,
        strokeLinejoin: "round",
      }))}
    </svg>
  );
}
