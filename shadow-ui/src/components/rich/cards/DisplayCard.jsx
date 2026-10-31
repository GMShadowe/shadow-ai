import ListCard from "./ListCard.jsx";
import ChartCard from "./ChartCard.jsx";
import ImagesCard from "./ImagesCard.jsx";

const CARDS = { list: ListCard, chart: ChartCard, images: ImagesCard };

export default function DisplayCard({ panel }) {
  const Card = panel ? CARDS[panel.kind] : null;
  return Card ? <Card panel={panel} /> : null;
}
