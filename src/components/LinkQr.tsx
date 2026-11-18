"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** A QR code for a link (a student's invite link on a card or a class screen), drawn in the browser. */
export function LinkQr({ url, label, size = 132 }: { url: string; label: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(url, { margin: 1, width: size * 2, errorCorrectionLevel: "M" })
      .then((d) => { if (live) setSrc(d); })
      .catch(() => setSrc(null));
    return () => { live = false; };
  }, [url, size]);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt={label} />;
}
