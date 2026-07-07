import React from 'react';
import { MapPinIcon } from './icons';

// A keyless OpenStreetMap static map: one raster tile rendered as an <img>, with
// the location guess drawn as a confidence circle + pin overlaid in CSS. Zoom is
// chosen so the uncertainty radius reads as ~a third of the frame. No API key, no
// external script — an <img src> to the OSM tile server, token-styled chrome.

function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
}

function pickZoom(lat: number, radiusM: number): number {
  // Target: radius ≈ 80px of a 256px tile.
  const targetMpp = Math.max(radiusM, 40) / 80;
  const z = Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180)) / targetMpp);
  return Math.max(13, Math.min(18, Math.round(z)));
}

export function StaticMap({
  lat,
  lng,
  radiusM,
  className,
}: {
  lat: number;
  lng: number;
  radiusM: number;
  className?: string;
}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const zoom = pickZoom(lat, radiusM || 200);
  const n = Math.pow(2, zoom);
  const latRad = (lat * Math.PI) / 180;

  const xTileF = ((lng + 180) / 360) * n;
  const yTileF = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n;
  const xTile = Math.floor(xTileF);
  const yTile = Math.floor(yTileF);

  // Fractional position of the pin within its tile → % offset in the square frame.
  const leftPct = (xTileF - xTile) * 100;
  const topPct = (yTileF - yTile) * 100;

  // Confidence circle diameter as a % of the 256px tile frame.
  const mpp = metersPerPixel(lat, zoom);
  const radiusPct = (radiusM / mpp / 256) * 100;
  const diameterPct = Math.max(6, Math.min(90, radiusPct * 2));

  const tileUrl = `https://tile.openstreetmap.org/${zoom}/${xTile}/${yTile}.png`;

  return (
    <div
      className={
        'relative aspect-square w-full max-w-sm overflow-hidden rounded-lg border border-border bg-muted ' +
        (className ?? '')
      }
    >
      <img
        src={tileUrl}
        alt=""
        aria-hidden
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Confidence circle */}
      <div
        className="absolute rounded-full border-2 border-agent bg-agent/20"
        style={{
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${diameterPct}%`,
          height: `${diameterPct}%`,
          transform: 'translate(-50%, -50%)',
        }}
      />
      {/* Pin at the guess center */}
      <div
        className="absolute"
        style={{ left: `${leftPct}%`, top: `${topPct}%`, transform: 'translate(-50%, -100%)' }}
      >
        <MapPinIcon className="h-6 w-6 text-agent drop-shadow" />
      </div>
    </div>
  );
}
