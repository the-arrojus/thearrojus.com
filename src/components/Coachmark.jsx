export default function Coachmark({ show, children, className = "" }) {
  if (!show) return null;
  return (
    <div className={`pointer-events-none text-center text-sm text-gray-600 ${className}`}>
      <span className="inline-block rounded-full bg-gray-100 px-3 py-1 shadow-sm">
        {children}
      </span>
    </div>
  );
}