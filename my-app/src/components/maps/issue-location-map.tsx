"use client";

import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const markerIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const openingView = { center: [22.5, 79] as [number, number], zoom: 5 };

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

function ClickToPlace({ onPick }: { onPick: (latitude: string, longitude: string) => void }) {
  useMapEvents({
    click(event) {
      onPick(formatCoordinate(event.latlng.lat), formatCoordinate(event.latlng.lng));
    },
  });
  return null;
}

function KeepPointInView({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    const point = L.latLng(latitude, longitude);
    if (!map.getBounds().contains(point)) {
      map.setView(point, Math.max(map.getZoom(), 16));
    }
  }, [latitude, longitude, map]);
  return null;
}

export function IssueLocationMap({
  tiles,
  point,
  onPick,
}: {
  tiles: { url: string; attribution: string };
  point: { latitude: number; longitude: number } | null;
  onPick: (latitude: string, longitude: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <MapContainer
        center={point ? [point.latitude, point.longitude] : openingView.center}
        zoom={point ? 16 : openingView.zoom}
        scrollWheelZoom={false}
        zoomAnimation={false}
        fadeAnimation={false}
        className="h-72 w-full"
        style={{ zIndex: 0 }}
        aria-label="Issue location map"
      >
        <TileLayer attribution={tiles.attribution} url={tiles.url} />
        <ClickToPlace onPick={onPick} />
        {point ? <KeepPointInView latitude={point.latitude} longitude={point.longitude} /> : null}
        {point ? (
          <Marker
            position={[point.latitude, point.longitude]}
            draggable
            icon={markerIcon}
            eventHandlers={{
              dragend(event) {
                const marker = event.target as L.Marker;
                const next = marker.getLatLng();
                onPick(formatCoordinate(next.lat), formatCoordinate(next.lng));
              },
            }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
