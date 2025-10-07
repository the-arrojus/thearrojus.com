import { useEffect, useRef, useState } from "react";
import useWindowSize from "../hooks/useWindowSize";

export default function Carousel({ headerHeight, images = [], intervalMs = 5000 }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const dynamicHeight = isMobile ? undefined : `calc(100vh - ${headerHeight}px)`;

  const intervalRef = useRef(null);
  const containerRef = useRef(null);

  // Auto-advance slides
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!paused && images.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrent((prev) => (prev + 1) % images.length);
      }, intervalMs);
    }
    return () => clearInterval(intervalRef.current);
  }, [paused, images.length, intervalMs]);

  if (!images.length) return null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden ${isMobile ? "aspect-video" : ""}`}
      style={dynamicHeight ? { height: dynamicHeight } : {}}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Image carousel"
    >
      {images.map((src, index) => {
        const isActive = index === current;
        const isAdjacent =
          index === (current + 1) % images.length ||
          index === (current - 1 + images.length) % images.length;

        return (
          <img
            key={index}
            src={src}
            alt={`Slide ${index + 1}`}
            loading={isActive || isAdjacent ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={isActive ? "high" : "auto"}
            className={`absolute inset-0 object-cover transition-opacity duration-700 ease-out
              ${isActive ? "opacity-100 z-20" : "opacity-0 z-10"}
            animated-zoom`}
            style={{ willChange: "opacity, transform" }}
          />
        );
      })}
    </div>
  );
}