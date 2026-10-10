"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export function PublicExploreMap({ tiles }: { tiles: { url: string; attribution: string } }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <MapContainer
        center={[22.5, 79]}
        zoom={5}
        scrollWheelZoom={false}
        zoomAnimation={false}
        fadeAnimation={false}
        className="h-80 w-full"
        style={{ zIndex: 0 }}
        aria-label="Published reports map"
      >
        <TileLayer attribution={tiles.attribution} url={tiles.url} />
      </MapContainer>
    </div>
  );
}
