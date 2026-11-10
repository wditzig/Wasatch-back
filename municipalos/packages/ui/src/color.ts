/** WCAG relative luminance helpers used to keep tenant branding readable. */
function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const FALLBACK = "#4353c9";
const AA_NORMAL_TEXT = 4.5;

function darken(hex: string, factor: number): string {
  const rgb = parseHex(hex)!;
  return (
    "#" +
    rgb
      .map((v) =>
        Math.round(v * factor)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/**
 * Turns a municipality's configured brand colour into a safe pair of background and text
 * colours that always meets WCAG AA (4.5:1) for normal text:
 *  - invalid values fall back to the MunicipalOS default (also prevents CSS injection);
 *  - white or near-black text is chosen, whichever contrasts more;
 *  - mid-tones where neither reaches 4.5:1 are darkened step by step until white text does.
 * A city can therefore never configure unreadable buttons or headers.
 */
export function cityColors(primary: string | undefined): { primary: string; onPrimary: string } {
  let color = primary && parseHex(primary) ? primary.trim().toLowerCase() : FALLBACK;
  if (!color.startsWith("#")) color = `#${color}`;
  const white = contrastRatio(color, "#ffffff") ?? 0;
  const dark = contrastRatio(color, "#0f172a") ?? 0;
  if (Math.max(white, dark) >= AA_NORMAL_TEXT) {
    return { primary: color, onPrimary: white >= dark ? "#ffffff" : "#0f172a" };
  }
  for (let i = 0; i < 20 && (contrastRatio(color, "#ffffff") ?? 0) < AA_NORMAL_TEXT; i++) {
    color = darken(color, 0.92);
  }
  return { primary: color, onPrimary: "#ffffff" };
}
