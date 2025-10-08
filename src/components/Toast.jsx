import { motion } from "framer-motion";

export default function Toast({ message, type = "success" }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`fixed bottom-6 right-6 z-50 rounded-md px-4 py-2 text-sm shadow-lg text-white ${
        type === "error" ? "bg-red-600" : "bg-green-600"
      }`}
    >
      {message}
    </motion.div>
  );
}