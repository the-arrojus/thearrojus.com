import { motion } from "framer-motion";
import clsx from "clsx";

function Spinner({ className = "h-4 w-4" }) {
  return (
    <svg className={clsx("animate-spin text-current", className)} viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}

const variants = {
  default: "bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:ring-indigo-600",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-300",
  destructive: "bg-rose-600 text-white hover:bg-rose-500 focus-visible:ring-rose-600",
  outline: "border border-gray-300 bg-transparent hover:bg-gray-100 text-gray-900 focus-visible:ring-gray-300",
  ghost: "bg-transparent text-gray-900 hover:bg-gray-100 focus-visible:ring-gray-300",
};

const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-base",
};

export default function Button({
  children,
  type = "button",
  onClick,
  variant = "default",
  size = "md",
  disabled = false,
  loading = false,
  loadingText,
  className,
  ...props
}) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      whileHover={!isDisabled ? { y: -1 } : undefined}
      whileTap={!isDisabled ? { scale: 0.97 } : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={clsx(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <Spinner className="h-4 w-4 mr-2" />
          {loadingText ?? "Loading…"}
        </>
      ) : (
        children
      )}
    </motion.button>
  );
}