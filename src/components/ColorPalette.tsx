import { useState } from "react";
import { useColorPalette } from "../hooks/useColorPalette";

interface ColorPaletteProps {
  imageUrl: string | undefined;
}

export function ColorPalette({ imageUrl }: ColorPaletteProps) {
  const { palette, isLoading } = useColorPalette(imageUrl);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  if (isLoading || !palette || palette.length === 0) return null;

  const handleCopy = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 1500);
    } catch {
      // Clipboard not available
    }
  };

  return (
    <div className="color-palette" aria-label="Extracted color palette">
      <div className="color-palette__swatches">
        {palette.map((swatch) => (
          <button
            key={swatch.hex}
            type="button"
            className={`color-palette__swatch ${copiedHex === swatch.hex ? "is-copied" : ""}`}
            style={{ backgroundColor: swatch.hex }}
            onClick={() => handleCopy(swatch.hex)}
            aria-label={`Copy color ${swatch.hex} (${swatch.percentage}%)`}
            title={`${swatch.hex} · ${swatch.percentage}%`}
          >
            {copiedHex === swatch.hex && (
              <span className="color-palette__copied">Copied</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
