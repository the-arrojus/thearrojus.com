import { useEffect, useMemo, useState } from "react";
import { db } from "../../lib/firebase.js";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit as fsLimit,
  getDoc,
  doc as fsDoc,
} from "firebase/firestore";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function makeHandle(name = "") {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, "")
    .trim()
    .replace(/[\s_]+/g, "");
}

function StarRating({ value = 5 }) {
  const count = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <div className="flex items-center gap-1" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < count ? "text-yellow-500" : "text-gray-300"}>
          ★
        </span>
      ))}
    </div>
  );
}

/**
 * Map Firestore testimonial doc → base UI shape.
 * Testimonial docs include: token, fullName, event, stars, description, submittedAt
 * We will fetch avatarUrl from testimonialInvites/{token}.
 */
function mapDocToBase(d) {
  const body = d.description ?? "";
  const name = d.fullName ?? "Anonymous";
  const handle = makeHandle(name);
  const event = d.event ?? null;
  const stars = d.stars ?? 5;
  const submittedAt = d.submittedAt ?? null;
  const token = d.token ?? null;
  return {
    body,
    author: { name, handle, imageUrl: "" }, // filled after avatar lookup
    event,
    stars,
    submittedAt,
    token,
  };
}

export default function PublicTestimonials({ max = 24 }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Public, read-only feed of testimonials. Make sure your Firestore rules allow reads.
    const q = query(
      collection(db, "testimonials"),
      orderBy("submittedAt", "desc"),
      fsLimit(max)
    );

    const unsub = onSnapshot(
      q,
      async (snap) => {
        try {
          const base = snap.docs.map((d) => mapDocToBase(d.data()));

          // Collect tokens and look up avatarUrl from testimonialInvites/{token}
          const tokens = Array.from(
            new Set(base.map((t) => t.token).filter(Boolean))
          );

          // Fetch invites one-by-one (safe for small lists; can batch if needed)
          const avatarMap = Object.create(null);
          await Promise.all(
            tokens.map(async (tkn) => {
              try {
                const invRef = fsDoc(db, "testimonialInvites", tkn);
                const invSnap = await getDoc(invRef);
                if (invSnap.exists()) {
                  const inv = invSnap.data();
                  if (inv?.avatarUrl) avatarMap[tkn] = inv.avatarUrl;
                }
              } catch {
                // ignore individual fetch errors; leave avatar undefined
              }
            })
          );

          // Merge avatars into items
          const merged = base.map((t) => ({
            ...t,
            author: {
              ...t.author,
              imageUrl: t.token ? avatarMap[t.token] || "" : "",
            },
          }));

          setItems(merged);
          setLoading(false);
        } catch (e) {
          setError(e?.message || "Failed to load testimonials");
          setLoading(false);
        }
      },
      (e) => {
        setError(e?.message || "Failed to load testimonials");
        setLoading(false);
      }
    );
    return () => unsub();
  }, [max]);

  const featuredTestimonial = items[0] ?? null;

  // Distribute the rest into 4 columns (two column groups) like the provided UI
  const gridColumns = useMemo(() => {
    const rest = items.slice(1);
    const cols = [[], [], [], []];
    rest.forEach((t, i) => cols[i % 4].push(t));
    return [cols.slice(0, 2), cols.slice(2, 4)]; // [[col0,col1],[col2,col3]]
  }, [items]);

  if (loading) {
    return (
      <div className="relative isolate bg-white pt-24 pb-32 sm:pt-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base/7 font-semibold text-indigo-600">Testimonials</h2>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              Loading testimonials…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative isolate bg-white pt-24 pb-32 sm:pt-32">
        <div className="mx-auto max-w-2xl text-center px-6">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate bg-white pt-24 pb-32 sm:pt-32">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-1/2 -z-10 -translate-y-1/2 transform-gpu overflow-hidden opacity-30 blur-3xl"
      >
        <div
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
          className="ml-[max(50%,38rem)] aspect-1313/771 w-328.25 bg-linear-to-tr from-[#ff80b5] to-[#9089fc]"
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 flex transform-gpu overflow-hidden pt-32 opacity-25 blur-3xl sm:pt-40 xl:justify-end"
      >
        <div
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
          className="-ml-88 aspect-1313/771 w-328.25 flex-none origin-top-right rotate-30 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] xl:mr-[calc(50%-12rem)] xl:ml-0"
        />
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base/7 font-semibold text-indigo-600">Testimonials</h2>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-balance text-gray-900 sm:text-5xl">
            We have worked with wonderful people
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 grid-rows-1 gap-8 text-sm/6 text-gray-900 sm:mt-20 sm:grid-cols-2 xl:mx-0 xl:max-w-none xl:grid-flow-col xl:grid-cols-4">
          {/* Featured card (most recent) */}
          {featuredTestimonial ? (
            <figure className="rounded-2xl bg-white shadow-lg ring-1 ring-gray-900/5 sm:col-span-2 xl:col-start-2 xl:row-end-1">
              <blockquote className="p-6 text-lg font-semibold tracking-tight text-gray-900 sm:p-12 sm:text-xl/8">
                <div className="mb-3">
                  <StarRating value={featuredTestimonial.stars} />
                </div>
                <p>{`“${featuredTestimonial.body}”`}</p>
              </blockquote>
              <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-4 border-t border-gray-900/10 px-6 py-4 sm:flex-nowrap">
                {/* Only render <img> if we have a URL */}
                {featuredTestimonial.author.imageUrl ? (
                  <img
                    alt={featuredTestimonial.author.name}
                    src={featuredTestimonial.author.imageUrl}
                    className="size-10 flex-none rounded-full bg-gray-50 object-cover"
                  />
                ) : (
                  <div className="size-10 flex-none rounded-full bg-gray-200" />
                )}
                <div className="flex-auto">
                  <div className="font-semibold text-gray-900">
                    {featuredTestimonial.author.name}
                  </div>
                  {featuredTestimonial.event && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {featuredTestimonial.event}
                    </div>
                  )}
                </div>
              </figcaption>
            </figure>
          ) : null}

          {/* Grid columns for the rest */}
          {gridColumns.map((columnGroup, columnGroupIdx) => (
            <div key={columnGroupIdx} className="space-y-8 xl:contents xl:space-y-0">
              {columnGroup.map((column, columnIdx) => (
                <div
                  key={columnIdx}
                  className={classNames(
                    (columnGroupIdx === 0 && columnIdx === 0) ||
                      (columnGroupIdx === gridColumns.length - 1 &&
                        columnIdx === columnGroup.length - 1)
                      ? "xl:row-span-2"
                      : "xl:row-start-1",
                    "space-y-8"
                  )}
                >
                  {column.map((t, i) => (
                    <figure
                      key={`${t.author.handle}-${i}`}
                      className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-900/5"
                    >
                      <blockquote className="text-gray-900">
                        <div className="mb-2">
                          <StarRating value={t.stars} />
                        </div>
                        <p>{`“${t.body}”`}</p>
                      </blockquote>
                      <figcaption className="mt-6 flex items-center gap-x-4">
                        {t.author.imageUrl ? (
                          <img
                            alt={t.author.name}
                            src={t.author.imageUrl}
                            className="size-10 rounded-full bg-gray-50 object-cover"
                          />
                        ) : (
                          <div className="size-10 rounded-full bg-gray-200" />
                        )}
                        <div>
                          <div className="font-semibold text-gray-900">{t.author.name}</div>
                          {t.event && (
                            <div className="text-xs text-gray-500 mt-0.5">{t.event}</div>
                          )}
                        </div>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <div className="mx-auto mt-10 max-w-md text-center text-gray-600">
            No testimonials yet — check back soon!
          </div>
        )}
      </div>
    </div>
  );
}