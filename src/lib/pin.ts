/** Game PINs are 6 digits. Players may type them with spaces ("482 915"). */
export function normalizePin(input: string): string | null {
  const digits = input.replace(/\s+/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

/** Shows a PIN the way Kahoot does: "482 915". */
export function formatPin(pin: string): string {
  return pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin;
}
