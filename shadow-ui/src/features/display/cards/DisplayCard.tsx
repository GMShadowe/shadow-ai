import type { Panel } from "../panels";
import ChartCard from "./ChartCard";
import ImagesCard from "./ImagesCard";
import ListCard from "./ListCard";

export default function DisplayCard({ panel }: { panel: Panel | null }) {
  if (!panel) return null;
  switch (panel.kind) {
    case "list":
      return <ListCard panel={panel} />;
    case "chart":
      return <ChartCard panel={panel} />;
    case "images":
      return <ImagesCard panel={panel} />;
  }
}
