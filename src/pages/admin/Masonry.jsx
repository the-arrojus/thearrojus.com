import { useEffect, useMemo, useRef, useState } from "react";
import { db, storage } from "../../lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  deleteDoc,
  writeBatch,
  limit,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
} from "firebase/storage";
import { AnimatePresence, motion } from "framer-motion";
import Button from "../../components/Button";
import Coachmark from "../../components/Coachmark";
import { useAutoCoachmark } from "../../hooks/useAutoCoachmark";

/* -------------------- image tuning -------------------- */
const OPT_MAX_DIM = 2400;
const OPT_QUALITY = 0.9;
const TINY_DIM = 20;

function shouldSkipOptimization(file, imgWidth, imgHeight) {
  const longest = Math.max(imgWidth, imgHeight);
  return (
    file?.type === "image/jpeg" &&
    longest <= 2200 &&
    file.size <= 2.5 * 1024 * 1024
  );
}

/* ----------------- drag edge auto-scroll -------------- */
const EDGE_PX = 96;
const MIN_SPEED = 6;
const MAX_SPEED = 28;

function calcSpeed(y, vh) {
  if (y < EDGE_PX) {
    const t = (EDGE_PX - y) / EDGE_PX;
    return -Math.max(MIN_SPEED, t * MAX_SPEED);
  }
  if (y > vh - EDGE_PX) {
    const t = (y - (vh - EDGE_PX)) / EDGE_PX;
    return Math.max(MIN_SPEED, t * MAX_SPEED);
  }
  return 0;
}

/* ------------------------------------------------------ */
async function fileToImageBitmap(file) {
  return await createImageBitmap(file);
}
function drawToCanvas(imgBitmap, maxDim, quality = OPT_QUALITY) {
  const { width, height } = imgBitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgBitmap, 0, 0, w, h);
  return {
    toBlob: () =>
      new Promise((res) => canvas.toBlob(res, "image/jpeg", quality)),
  };
}
async function makeOptimizedAndBlur(file) {
  const img = await fileToImageBitmap(file);
  let optimizedBlob;
  if (shouldSkipOptimization(file, img.width, img.height)) {
    optimizedBlob = file;
  } else {
    const opt = drawToCanvas(img, OPT_MAX_DIM, OPT_QUALITY);
    optimizedBlob = await opt.toBlob();
  }

  const tiny = drawToCanvas(img, TINY_DIM, 0.7);
  const tinyBlob = await tiny.toBlob();
  const blurDataURL = await new Promise((res) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.readAsDataURL(tinyBlob);
  });
  return { optimizedBlob, blurDataURL };
}

/* ---------------------------------------------------- */
async function deleteFolder(path) {
  const folderRef = ref(storage, path);
  const { items, prefixes } = await listAll(folderRef);
  await Promise.all(items.map((it) => deleteObject(it).catch(() => {})));
  await Promise.all(prefixes.map((p) => deleteFolder(p.fullPath)));
}

const MAX_MASONRY = 40;

/* ---------- Accessibility hook for reduced motion ---------- */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/* ---------- Animated image (with badge) ---------- */
function MasonryAnimatedImage({ src, alt = "", badgeContent, containerClassName = "" }) {
  const reduce = usePrefersReducedMotion();
  return (
    <div className={`relative grid [grid-template-areas:_'stack'] overflow-hidden ${containerClassName}`}>
      {badgeContent && (
        <span className="absolute left-2 top-2 z-30 rounded-full bg-black/60 text-white text-xs px-2 py-1 leading-none">
          {badgeContent}
        </span>
      )}
      <AnimatePresence initial={false} mode="popLayout">
        <motion.img
          key={src}
          src={src}
          alt={alt}
          draggable={false}
          loading="lazy"
          className="block w-full h-auto object-cover [grid-area:stack]"
          initial={{ opacity: 0, scale: reduce ? 1.0 : 1.02 }}
          animate={{
            opacity: 1,
            scale: 1.0,
            transition: {
              opacity: { duration: reduce ? 0.15 : 0.7, ease: "easeOut" },
              scale: { duration: reduce ? 0.0 : 7.0, ease: "linear" },
            },
          }}
          exit={{ opacity: 0, transition: { duration: reduce ? 0.1 : 0.4 } }}
          style={{ willChange: "opacity, transform" }}
        />
      </AnimatePresence>
    </div>
  );
}

/* ---------- Main Masonry Component ---------- */
export default function Masonry() {
  const [items, setItems] = useState([]);
  const [busyGlobal, setBusyGlobal] = useState(false);
  const [busyIds, setBusyIds] = useState(new Set());
  const [dragId, setDragId] = useState(null);
  const [overall, setOverall] = useState({ totalBytes: 0, transferred: 0, active: 0 });

  const uploadInputRef = useRef(null);
  const replaceInputRefs = useRef({});
  const containerRef = useRef(null);

  const dragAuto = useRef({ active: false, y: 0, raf: 0, cleanup: null });

  // brief coachmark when there are 2+ items
  const [showCoach] = useAutoCoachmark(items.length >= 2, 2400);

  useEffect(() => {
    const q = query(collection(db, "masonry"), orderBy("index", "asc"), limit(MAX_MASONRY));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(arr);
    });
    return () => {
      unsub();
      dragAuto.current.cleanup?.();
    };
  }, []);

  const canAdd = items.length < MAX_MASONRY;

  async function uploadOriginalAndOptimized({ file, id }) {
    const { optimizedBlob, blurDataURL } = await makeOptimizedAndBlur(file);
    const originalRef = ref(storage, `masonry/${id}/original.jpg`);
    const optimizedRef = ref(storage, `masonry/${id}/optimized.jpg`);

    const totalBytes = file.size + (optimizedBlob?.size ?? 0);
    let origPrev = 0;
    let optPrev = 0;

    setOverall((s) => ({
      totalBytes: s.totalBytes + totalBytes,
      transferred: s.transferred,
      active: s.active + 1,
    }));

    const bump = (deltaOrig, deltaOpt) =>
      setOverall((s) => ({ ...s, transferred: s.transferred + deltaOrig + deltaOpt }));

    const originalTask = uploadBytesResumable(originalRef, file, { contentType: file.type });
    const optimizedTask = uploadBytesResumable(optimizedRef, optimizedBlob, { contentType: "image/jpeg" });

    await Promise.all([
      new Promise((res, rej) =>
        originalTask.on("state_changed", (snap) => {
          const delta = snap.bytesTransferred - origPrev;
          origPrev = snap.bytesTransferred;
          bump(delta, 0);
        }, rej, res)
      ),
      new Promise((res, rej) =>
        optimizedTask.on("state_changed", (snap) => {
          const delta = snap.bytesTransferred - optPrev;
          optPrev = snap.bytesTransferred;
          bump(0, delta);
        }, rej, res)
      ),
    ]);

    const [originalURL, optimizedURL] = await Promise.all([
      getDownloadURL(originalRef),
      getDownloadURL(optimizedRef),
    ]);

    setOverall((s) => {
      const nextActive = Math.max(0, s.active - 1);
      const doneAll = nextActive === 0 && s.transferred >= s.totalBytes;
      return doneAll
        ? { totalBytes: 0, transferred: 0, active: 0 }
        : { ...s, active: nextActive };
    });

    return { originalURL, optimizedURL, blurDataURL };
  }

  const onPick = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !canAdd) return;

    setBusyGlobal(true);
    try {
      const slots = MAX_MASONRY - items.length;
      const selected = files.slice(0, slots);

      for (let i = 0; i < selected.length; i++) {
        const file = selected[i];
        const id =
          (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
            .toString()
            .replace(/-/g, "");
        const nextIndex = items.length + 1 + i;

        const { originalURL, optimizedURL, blurDataURL } =
          await uploadOriginalAndOptimized({ file, id });

        await setDoc(doc(db, "masonry", id), {
          index: nextIndex,
          originalPath: `masonry/${id}/original.jpg`,
          optimizedPath: `masonry/${id}/optimized.jpg`,
          originalURL,
          optimizedURL,
          blurDataURL,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error(err);
      alert("Upload failed.");
    } finally {
      setBusyGlobal(false);
    }
  };

  const onReplaceFile = async (item, file) => {
    if (!file) return;
    setBusyIds((s) => new Set(s).add(item.id));
    try {
      const { originalURL, optimizedURL, blurDataURL } =
        await uploadOriginalAndOptimized({ file, id: item.id });
      await setDoc(
        doc(db, "masonry", item.id),
        { originalURL, optimizedURL, blurDataURL, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error(err);
      alert("Replace failed.");
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(item.id);
        return n;
      });
    }
  };

  const onReplaceClick = (item) => replaceInputRefs.current[item.id]?.click();

  const onDelete = async (item) => {
    if (!confirm("Delete this image?")) return;
    const prev = items;
    const next = prev.filter((x) => x.id !== item.id).map((x, i) => ({ ...x, index: i + 1 }));
    setItems(next);
    setBusyIds((s) => new Set(s).add(item.id));
    try {
      await deleteFolder(`masonry/${item.id}`);
      await deleteDoc(doc(db, "masonry", item.id));

      const batch = writeBatch(db);
      next.forEach((x, i) =>
        batch.set(doc(db, "masonry", x.id), { index: i + 1, updatedAt: serverTimestamp() }, { merge: true })
      );
      await batch.commit();
    } catch (err) {
      console.error(err);
      alert("Delete failed.");
      setItems(prev);
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(item.id);
        return n;
      });
    }
  };

  const onDragStart = (id) => setDragId(id);
  const onDragOver = (e) => e.preventDefault();
  const onDrop = async (overId) => {
    if (!dragId || dragId === overId) return;
    const current = [...items];
    const from = current.findIndex((i) => i.id === dragId);
    const to = current.findIndex((i) => i.id === overId);
    const [moved] = current.splice(from, 1);
    current.splice(to, 0, moved);
    const reindexed = current.map((x, i) => ({ ...x, index: i + 1 }));
    setItems(reindexed);
    try {
      const batch = writeBatch(db);
      reindexed.forEach((x, i) =>
        batch.set(doc(db, "masonry", x.id), { index: i + 1, updatedAt: serverTimestamp() }, { merge: true })
      );
      await batch.commit();
    } catch (err) {
      console.error(err);
      alert("Reorder failed.");
    } finally {
      setDragId(null);
    }
  };

  const uploadPct = useMemo(() => {
    if (!overall.totalBytes) return 0;
    return Math.min(100, Math.round((overall.transferred / overall.totalBytes) * 100));
  }, [overall]);

  const isUploading = overall.active > 0 || busyGlobal;

  return (
    <div ref={containerRef} className="space-y-8">
      <style>{`
  .card {
    position: relative;
    transition:
      transform 220ms cubic-bezier(.2,.8,.2,1),
      box-shadow 220ms ease,
      border-color 220ms ease,
      filter 220ms ease;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 0.75rem; /* rounded-xl */
    background: white;
    will-change: transform, box-shadow, filter;
  }

  .card:hover {
    transform: translateY(-2px) scale(1.01);
    box-shadow:
      0 14px 30px rgba(0,0,0,.10),
      0 3px 10px rgba(0,0,0,.08);
  }

  .card:active {
    transform: translateY(0) scale(0.997);
    cursor: grabbing;
    box-shadow: 0 10px 22px rgba(0,0,0,.10);
  }

  /* --- gradient border on hover --- */
  .card::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(135deg, #a78bfa, #6366f1, #22d3ee);
    -webkit-mask: 
      linear-gradient(#fff 0 0) content-box, 
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
            mask-composite: exclude;
    pointer-events: none;
    opacity: 0;
    transition: opacity 220ms ease;
  }
  .card:hover::before {
    opacity: 1;
  }

  /* --- optional shine sweep --- */
  .card::after {
    content: "";
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    pointer-events: none;
    background: linear-gradient(120deg,
      transparent 0%,
      rgba(255,255,255,0.18) 10%,
      transparent 22%);
    transform: translateX(-130%);
    transition: transform 600ms ease;
  }
  .card:hover::after { transform: translateX(130%); }

  /* --- media zoom + color pop --- */
  .card .media img {
    transition: transform 750ms ease, filter 240ms ease;
    transform-origin: center;
    will-change: transform, filter;
  }
  .card:hover .media img {
    transform: scale(1.04);
    filter: saturate(1.06);
  }

  /* --- spotlight + press ripple --- */
  .card .spotlight {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background: radial-gradient(220px circle at 50% 50%, rgba(99,102,241,0.18), transparent 60%);
    opacity: 0;
    transition: opacity 220ms ease;
  }
  .card:hover .spotlight { opacity: 1; }

  .card .press {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    transform: translateZ(0);
  }
  .card:active .press {
    animation: pressPulse 480ms ease-out;
    background: radial-gradient(200px circle at 50% 50%, rgba(99,102,241,0.28), transparent 60%);
  }
  @keyframes pressPulse {
    0%   { opacity: .35; transform: scale(.98); }
    60%  { opacity: .15; transform: scale(1.01); }
    100% { opacity: 0;   transform: scale(1.03); }
  }

  .card:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 2px rgba(255,255,255,1),
      0 0 0 4px rgba(99,102,241,.65);
  }
`}</style>




      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Masonry</h1>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => uploadInputRef.current?.click()}
            disabled={!canAdd}
            loading={isUploading}
            loadingText="Working…"
            variant={canAdd ? "default" : "outline"}
          >
            {canAdd ? "Upload" : "Full"}
          </Button>
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            ref={uploadInputRef}
            onChange={onPick}
            disabled={!canAdd || isUploading}
          />
        </div>
      </div>

      {overall.totalBytes > 0 && (
        <div className="w-full rounded-lg bg-gray-200 overflow-hidden">
          <div
            className="h-2 bg-indigo-600 transition-[width] duration-200"
            style={{ width: `${uploadPct}%` }}
          />
        </div>
      )}

      {isUploading && items.length === 0 && (
        <div className="rounded-xl border p-6 text-center bg-white text-gray-700">
          <div className="flex items-center justify-center gap-3">
            <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" />
            </svg>
            <span>Uploading…</span>
          </div>
        </div>
      )}

      {/* brief hover/auto coachmark */}
      <Coachmark show={showCoach}>Drag any card to rearrange</Coachmark>

      {items.length > 0 && (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 [column-fill:_balance]">
          <AnimatePresence initial={false}>
            {items.map((it) => {
              const itemBusy = busyIds.has(it.id) || isUploading;
              return (
                <motion.div
                  key={it.id}
                  layout
                  initial={{ opacity: 0.6, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="card mb-4 break-inside-avoid rounded-xl border bg-white overflow-hidden cursor-grab"
                  draggable
                  tabIndex={0}
                  onDragStart={() => !isUploading && onDragStart(it.id)}
                  onDragOver={(e) => !isUploading && onDragOver(e)}
                  onDrop={() => !isUploading && onDrop(it.id)}
                  title={isUploading ? "" : "Drag to reorder"}
                >
                  {/* spotlight & press overlays */}
                  <span className="spotlight" aria-hidden="true" />
                  <span className="press" aria-hidden="true" />

                  <MasonryAnimatedImage
                    src={it.optimizedURL}
                    alt={`Masonry image ${it.index}`}
                    badgeContent={`#${it.index}`}
                    containerClassName="media"
                  />

                  <div className="p-3 flex items-center justify-end text-sm gap-2">
                    <Button
                      onClick={() => onReplaceClick(it)}
                      disabled={itemBusy}
                      loading={busyIds.has(it.id)}
                      loadingText="Working…"
                      variant="secondary"
                      size="sm"
                    >
                      Replace
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      ref={(el) => (replaceInputRefs.current[it.id] = el)}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) onReplaceFile(it, f);
                      }}
                    />
                    <Button
                      onClick={() => onDelete(it)}
                      disabled={itemBusy}
                      loading={busyIds.has(it.id)}
                      loadingText="Deleting…"
                      variant="destructive"
                      size="sm"
                    >
                      Delete
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}