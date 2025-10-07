import CarouselSection from "./CarouselSection";
import MasonrySection from "./MasonrySection";
import Testimonials from "./Testimonials";
export default function Home() {
  return (
    <section className="space-y-4">
      <CarouselSection />
      <MasonrySection />
      <Testimonials />
    </section>
  );
}