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

/* ---------- image helpers ---------- */
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
    toBlob: () => new Promise((res) => canvas.toBlob(res, "image/jpeg", quality)),
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

/* ---------- delete folder recursively ---------- */
async function deleteFolder(path) {
  const folderRef = ref(storage, path);
  const { items, prefixes } = await listAll(folderRef);
  await Promise.all(items.map((it) => deleteObject(it).catch(() => {})));
  await Promise.all(prefixes.map((p) => deleteFolder(p.fullPath)));
}

const MAX_IMAGES = 5;

/* ---------- reduced motion hook ---------- */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return reduced;
}

/* ---------- animated image ---------- */
function AnimatedImage({ src, alt = "" }) {
  const reduce = usePrefersReducedMotion();
  return (
    <div className="relative w-full h-full">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.img
          key={src}
          src={src}
          alt={alt}
          draggable={false}
          className="absolute inset-0 object-cover"
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

/* ---------- main component ---------- */
export default function AdminCarousel() {
  const [items, setItems] = useState([]);
  const [busyGlobal, setBusyGlobal] = useState(false);
  const [busyIds, setBusyIds] = useState(new Set());
  const [dragId, setDragId] = useState(null);
  const [overall, setOverall] = useState({ totalBytes: 0, transferred: 0, active: 0 });
  const uploadInputRef = useRef(null);
  const replaceInputRefs = useRef({});

  // coachmark shows briefly when there are 2+ items
  const [showCoach] = useAutoCoachmark(items.length >= 2, 2400);

  // realtime listener
  useEffect(() => {
    const q = query(collection(db, "gallery"), orderBy("index", "asc"), limit(MAX_IMAGES));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(arr);
    });
    return () => unsub();
  }, []);

  const canAdd = items.length < MAX_IMAGES;

  /* ---------- uploader ---------- */
  async function uploadOriginalAndOptimized({ file, id }) {
    const { optimizedBlob, blurDataURL } = await makeOptimizedAndBlur(file);
    const originalRef = ref(storage, `gallery/${id}/original.jpg`);
    const optimizedRef = ref(storage, `gallery/${id}/optimized.jpg`);
    const totalBytes = file.size + (optimizedBlob?.size ?? 0);
    let origPrev = 0;
    let optPrev = 0;

    setOverall((s) => ({
      totalBytes: s.totalBytes + totalBytes,
      transferred: s.transferred,
      active: s.active + 1,
    }));
    const bump = (d1, d2) =>
      setOverall((s) => ({ ...s, transferred: s.transferred + d1 + d2 }));

    const originalTask = uploadBytesResumable(originalRef, file, {
      contentType: file.type || "image/jpeg",
    });
    const optimizedTask = uploadBytesResumable(optimizedRef, optimizedBlob, {
      contentType: "image/jpeg",
    });

    const origPromise = new Promise((res, rej) => {
      originalTask.on(
        "state_changed",
        (snap) => {
          const delta = snap.bytesTransferred - origPrev;
          origPrev = snap.bytesTransferred;
          bump(delta, 0);
        },
        rej,
        res
      );
    });
    const optPromise = new Promise((res, rej) => {
      optimizedTask.on(
        "state_changed",
        (snap) => {
          const delta = snap.bytesTransferred - optPrev;
          optPrev = snap.bytesTransferred;
          bump(0, delta);
        },
        rej,
        res
      );
    });
    await Promise.all([origPromise, optPromise]);
    const [originalURL, optimizedURL] = await Promise.all([
      getDownloadURL(originalRef),
      getDownloadURL(optimizedRef),
    ]);
    setOverall((s) => {
      const nextActive = Math.max(0, s.active - 1);
      const doneAll = nextActive === 0 && s.transferred >= s.totalBytes;
      return doneAll ? { totalBytes: 0, transferred: 0, active: 0 } : { ...s, active: nextActive };
    });
    return { originalURL, optimizedURL, blurDataURL };
  }

  /* ---------- upload pick ---------- */
  const onPick = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    if (!canAdd) return alert(`Gallery is full (max ${MAX_IMAGES}).`);
    setBusyGlobal(true);
    try {
      const slots = Math.max(0, MAX_IMAGES - items.length);
      const selected = files.slice(0, slots);
      for (let i = 0; i < selected.length; i++) {
        const file = selected[i];
        const id = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
          .toString()
          .replace(/-/g, "");
        const nextIndex = items.length + 1 + i;
        const { originalURL, optimizedURL, blurDataURL } =
          await uploadOriginalAndOptimized({ file, id });
        await setDoc(doc(db, "gallery", id), {
          index: nextIndex,
          originalPath: `gallery/${id}/original.jpg`,
          optimizedPath: `gallery/${id}/optimized.jpg`,
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

  /* ---------- replace image ---------- */
  const onReplaceClick = (item) => {
    replaceInputRefs.current[item.id]?.click();
  };
  const onReplaceFile = async (item, file) => {
    if (!file) return;
    setBusyIds((s) => new Set(s).add(item.id));
    try {
      const { originalURL, optimizedURL, blurDataURL } =
        await uploadOriginalAndOptimized({ file, id: item.id });
      await setDoc(
        doc(db, "gallery", item.id),
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

  /* ---------- delete ---------- */
  const onDelete = async (item) => {
    if (!confirm("Delete this image?")) return;
    const prev = items;
    const next = prev.filter((x) => x.id !== item.id).map((x, i) => ({ ...x, index: i + 1 }));
    setItems(next);
    setBusyIds((s) => new Set(s).add(item.id));
    try {
      await deleteFolder(`gallery/${item.id}`);
      await deleteDoc(doc(db, "gallery", item.id));
      const batch = writeBatch(db);
      next.forEach((x, i) => {
        batch.set(doc(db, "gallery", x.id), { index: i + 1, updatedAt: serverTimestamp() }, { merge: true });
      });
      await batch.commit();
    } catch (err) {
      console.error(err);
      alert("Delete failed. Restoring previous state.");
      setItems(prev);
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(item.id);
        return n;
      });
    }
  };

  /* ---------- drag reorder ---------- */
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
        batch.set(
          doc(db, "gallery", x.id),
          { index: i + 1, updatedAt: serverTimestamp() },
          { merge: true }
        )
      );
      await batch.commit();
    } catch (err) {
      console.error(err);
      alert("Reorder failed. Reloading…");
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Carousel</h1>
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

      {/* Upload progress */}
      {overall.totalBytes > 0 && (
        <div className="w-full rounded-lg bg-gray-200 overflow-hidden">
          <div
            className="h-2 bg-indigo-600 transition-[width] duration-200"
            style={{ width: `${uploadPct}%` }}
          />
        </div>
      )}

      {/* While uploading & empty */}
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

      {/* Hover/auto coachmark (reusable component) */}
      <Coachmark show={showCoach}>
        Drag any card to rearrange
      </Coachmark>

      {/* Grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AnimatePresence initial={false}>
            {items.map((it) => (
              <motion.div
                key={it.id}
                layout
                initial={{ opacity: 0.6, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="rounded-xl border bg-white overflow-hidden flex flex-col cursor-grab active:cursor-grabbing"
                draggable
                onDragStart={() => !isUploading && onDragStart(it.id)}
                onDragOver={(e) => !isUploading && onDragOver(e)}
                onDrop={() => !isUploading && onDrop(it.id)}
                title={isUploading ? "" : "Drag to reorder"}
              >
                <div className="aspect-[3/2] overflow-hidden relative">
                  <AnimatedImage src={it.optimizedURL} alt={`Gallery image ${it.index}`} />
                  <span className="absolute left-2 top-2 z-30 rounded-full bg-black/60 text-white text-xs px-2 py-1 leading-none">
                    #{it.index}
                  </span>
                </div>

                <div className="px-3 py-2 flex items-center justify-end gap-2 text-sm">
                  <Button
                    onClick={() => onReplaceClick(it)}
                    disabled={busyIds.has(it.id) || isUploading}
                    loading={busyIds.has(it.id)}
                    loadingText="Working…"
                    variant="secondary"
                    size="sm"
                    className="h-8 px-3"
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
                    disabled={busyIds.has(it.id) || isUploading}
                    loading={busyIds.has(it.id)}
                    loadingText="Deleting…"
                    variant="destructive"
                    size="sm"
                    className="h-8 px-3"
                  >
                    Delete
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}