import Segmented from "./ui/Segmented.jsx";

const OPTIONS = [
  { id: "low", label: "Low", hint: "Up to 3 steps. Fastest." },
  { id: "medium", label: "Medium", hint: "Up to 6 steps." },
  { id: "high", label: "High", hint: "Up to 12 steps. Slowest, most thorough." },
];

export default function EffortPicker({ value, onChange }) {
  return <Segmented options={OPTIONS} value={value} onChange={onChange} size="sm" />;
}
