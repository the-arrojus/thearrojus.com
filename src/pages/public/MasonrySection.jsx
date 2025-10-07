import React, { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import FadeInOnScroll from "../../components/FadeInOnScroll";

function MasonrySection() {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchImages = async () => {
      setIsLoading(true);
      try {
        const q = query(collection(db, "masonry"), orderBy("index", "asc"));
        const snap = await getDocs(q);
        const imgs = snap.docs.map((d) => ({
          id: d.id,
          src: d.data().optimizedURL,
          blur: d.data().blurDataURL,
        }));
        setImages(imgs);
      } catch (err) {
        console.error("Error loading masonry images:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchImages();
  }, []);

  if (isLoading) {
    return <p style={{ textAlign: "center" }}>Loading images...</p>;
  }

  if (!images.length) {
    return <p style={{ textAlign: "center" }}>No images found.</p>;
  }

  return (
    <ResponsiveMasonry columnsCountBreakPoints={{ 350: 1, 750: 2, 900: 3 }}>
      <Masonry gutter="16px">
        {images.map((img, i) => (
          <FadeInOnScroll key={`${img.id}-${i}`}>
            <img
              src={img.src}
              alt={`Masonry ${img.id}`}
              loading="lazy"
              style={{
                width: "100%",
                display: "block",
                borderRadius: "8px",
                background: `url(${img.blur}) center / cover no-repeat`,
                transition: "opacity 0.3s ease",
              }}
            />
          </FadeInOnScroll>
        ))}
      </Masonry>
    </ResponsiveMasonry>
  );
}

export default MasonrySection;