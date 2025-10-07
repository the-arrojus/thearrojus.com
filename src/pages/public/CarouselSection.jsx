import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";

import Carousel from "../../components/Carousel";

export default function CarouselSection() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(
        query(collection(db, "gallery"), orderBy("index", "asc"), limit(5))
      );
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  if (!items.length) return null;

  const images = items.map((it) => it.optimizedURL);

  return (
    <section>
      <Carousel headerHeight={64} images={images} />
    </section>
  );
}
