import { useEffect, useState, useRef } from "react";
import useWindowSize from "../hooks/useWindowSize";

export default function Carousel({ headerHeight, images = [] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const dynamicHeight = isMobile ? undefined : `calc(100vh - ${headerHeight}px)`;

  const intervalRef = useRef(null);

  useEffect(() => {
    if (!paused && images.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrent((prev) => (prev + 1) % images.length);
      }, 5000);
    }

    return () => clearInterval(intervalRef.current);
  }, [paused, images.length]);

  if (!images.length) return null;

  return (
    <div
      className={`relative w-full overflow-hidden ${
        isMobile ? "aspect-video" : ""
      }`}
      style={dynamicHeight ? { height: dynamicHeight } : {}}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
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
            alt={`Slide ${index}`}
            loading={isActive || isAdjacent ? "eager" : "lazy"}
            className={`absolute inset-0 object-cover transform transition-all duration-1000 ease-in-out
              ${isActive ? "opacity-100 translate-x-0 z-20" : "opacity-0 translate-x-5 z-10"}
            `}
            style={{ transitionTimingFunction: "ease-in-out" }}
          />
        );
      })}
    </div>
  );
}