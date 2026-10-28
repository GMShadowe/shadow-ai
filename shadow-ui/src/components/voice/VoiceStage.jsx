import ListCard from "./cards/ListCard.jsx";
import ChartCard from "./cards/ChartCard.jsx";
import ImageCard from "./cards/ImageCard.jsx";

/* The middle of the screen: the result of the exchange, and nothing else.
   No reasoning, no tool rows — those belong to the chat screen.

   One kind per panel, picked by `kind` on plain data. Adding a fourth
   card later means one more entry here, not a new schema. */
const CARDS = {
  list: ListCard,
  chart: ChartCard,
  image: ImageCard,
};

export default function VoiceStage({ panel, state }) {
  if (!panel) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <p className="animate-fade max-w-sm text-center text-sm text-ink-muted">
          {state === "idle"
            ? "Tap the mic and talk. Anything worth looking at — lists, numbers, pictures — shows up here."
            : "Nothing to show for this answer."}
        </p>
      </div>
    );
  }

  const Card = CARDS[panel.kind];
  if (!Card) return null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      {/* Centred and capped: the right side of the screen stays empty. */}
      <div className="mx-auto w-full max-w-xl">
        <Card panel={panel} />
      </div>
    </div>
  );
}
