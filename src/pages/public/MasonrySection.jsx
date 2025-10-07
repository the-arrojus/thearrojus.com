import React, { useEffect, useMemo, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import FadeInOnScroll from "../../components/FadeInOnScroll";

function MasonrySection() {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const breakpoints = useMemo(() => ({ 350: 1, 750: 2, 900: 3 }), []);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const q = query(collection(db, "masonry"), orderBy("index", "asc"));
        const snap = await getDocs(q);
        const imgs = snap.docs.map((d) => {
          const data = d.data() || {};
          const width = data.width;
          const height = data.height;
          const aspectRatio =
            data.aspectRatio ||
            (width && height ? width / height : undefined);

          return {
            id: d.id,
            src: data.optimizedURL,
            blur: data.blurDataURL,
            alt: data.alt || "Gallery image",
            width,
            height,
            aspectRatio,
          };
        });
        if (isMounted) setImages(imgs);
      } catch (err) {
        console.error("Error loading masonry images:", err);
        if (isMounted) setError("Couldn’t load images.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="masonry-wrapper">
        <div aria-busy="true" className="masonry-skeletons">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="masonry-skeleton-card" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="masonry-wrapper" style={{ textAlign: "center" }}>
        <p>{error}</p>
        <button onClick={() => location.reload()}>Retry</button>
      </div>
    );
  }

  if (!images.length) {
    return <p style={{ textAlign: "center" }}>No images found.</p>;
  }

  return (
    <div className="masonry-wrapper">
      <ResponsiveMasonry columnsCountBreakPoints={breakpoints}>
        <Masonry gutter="16px">
          {images.map((img, i) => (
            <FadeInOnScroll key={img.id}>
              <PictureWithPlaceholder img={img} priority={i < 3} />
            </FadeInOnScroll>
          ))}
        </Masonry>
      </ResponsiveMasonry>
    </div>
  );
}

export default MasonrySection;

/* ---------- Helpers ---------- */

function PictureWithPlaceholder({ img, priority = false }) {
  const [loaded, setLoaded] = useState(false);

  const style = img.aspectRatio
    ? { aspectRatio: String(img.aspectRatio) }
    : img.width && img.height
    ? { aspectRatio: String(img.width / img.height) }
    : {};

  return (
    <figure className="masonry-figure" style={style}>
      <img
        src={img.src}
        alt={img.alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        sizes="(max-width: 750px) 100vw, (max-width: 900px) 50vw, 33vw"
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          e.currentTarget.src = "/images/fallback.jpg"; // your fallback image
          e.currentTarget.style.objectFit = "contain";
        }}
        className={`masonry-img ${loaded ? "is-loaded" : ""}`}
        style={{
          background: img.blur
            ? `url(${img.blur}) center / cover no-repeat`
            : undefined,
        }}
      />
    </figure>
  );
}
