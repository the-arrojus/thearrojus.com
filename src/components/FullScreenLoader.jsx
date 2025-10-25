import Spinner from "./Spinner";

export default function FullScreenLoader({ label = "Loading…" }) {
  return (
    <div className="min-h-[60vh] grid place-items-center p-6">
      <div className="flex flex-col items-center gap-4">
        <Spinner size={56} label={label} />
      </div>
    </div>
  );
}
