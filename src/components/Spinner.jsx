export default function Spinner({ size = 48, label = "Loading…" }) {
  const px = typeof size === "number" ? `${size}px` : size;
  return (
    <div className="flex items-center gap-3" role="status" aria-live="polite">
      <div
        className="animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600"
        style={{ width: px, height: px }}
      />
      {label && <span className="text-sm text-gray-500">{label}</span>}
    </div>
  );
}
