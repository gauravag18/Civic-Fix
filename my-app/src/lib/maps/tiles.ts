import "server-only";

const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    if (character === "&") return "&amp;";
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    if (character === '"') return "&quot;";
    return "&#39;";
  });
}

function tileUrl(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed.includes("{z}") || !trimmed.includes("{x}") || !trimmed.includes("{y}")) {
    return DEFAULT_TILE_URL;
  }
  try {
    const probe = new URL(trimmed.replaceAll("{z}", "0").replaceAll("{x}", "0").replaceAll("{y}", "0"));
    if (probe.protocol !== "https:") return DEFAULT_TILE_URL;
  } catch {
    return DEFAULT_TILE_URL;
  }
  return trimmed;
}

export type MapTiles = {
  url: string;
  attribution: string;
};

export function mapTileConfig(): MapTiles {
  const configured = process.env.MAP_TILE_ATTRIBUTION?.trim();
  return {
    url: tileUrl(process.env.MAP_TILE_URL),
    attribution: configured ? escapeHtml(configured) : DEFAULT_ATTRIBUTION,
  };
}
