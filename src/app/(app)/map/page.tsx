import type { Metadata } from "next";
import { MapView } from "@/components/views/MapView";

export const metadata: Metadata = { title: "Knowledge Map" };

export default function MapPage() {
  return <MapView />;
}
