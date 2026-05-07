import { useState, useEffect, useRef, memo, useCallback, useMemo, TouchEvent as ReactTouchEvent } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, remove, update } from "@/lib/rtdbPb";
import { X, Image as ImageIcon, ZoomIn, ArrowLeft, Download, ChevronLeft, ChevronRight, Trash2, Pin, PinOff, Star } from "lucide-react";
import { format } from "date-fns";

interface GalleryImage {
  key: string;
  full: string;
  thumb: string;
  local: string;
  timestamp: number;
  pinned?: boolean;
}

interface GalleryModalProps {
  open: boolean;
  onClose: () => void;
  deviceId: string;
}

const PAGE_SIZE = 40;

const ImageCard = memo(({ img, onClick }: { img: GalleryImage; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="group relative aspect-square rounded-2xl overflow-hidden border border-border/60 bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300"
  >
    <img
      src={img.thumb}
      alt={img.local || "Gallery image"}
      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      loading="lazy"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    {img.pinned && (
      <div className="absolute top-1.5 left-1.5 h-5 w-5 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
        <Pin className="h-2.5 w-2.5 text-primary-foreground" />
      </div>
    )}
    <div className="absolute bottom-0 left-0 right-0 p-2">
      <p className="text-[8px] text-white/90 truncate font-semibold drop-shadow-sm">{img.local || "Image"}</p>
      <p className="text-[7px] text-white/60 drop-shadow-sm">
        {format(new Date(img.timestamp), "MMM d, HH:mm")}
      </p>
    </div>
    <div className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <ZoomIn className="h-3 w-3 text-white" />
    </div>
  </button>
));
ImageCard.displayName = "ImageCard";

const parseSnap = (val: any): GalleryImage[] => {
  if (!val) return [];
  return Object.entries(val).map(([key, v]: any) => ({
    key,
    full: v.full || "",
    thumb: v.thumb || "",
    local: v.local || "",
    timestamp: v.timestamp || 0,
    pinned: v.pinned || false,
  }));
};

const buildPageList = (current: number, total: number): (number | "...")[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("...");
  pages.push(total);
  return pages;
};

const GalleryModal = ({ open, onClose, deviceId }: GalleryModalProps) => {
  const [allImages, setAllImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pinned">("all");
  const [page, setPage] = useState(1);
  const [fullImageLoaded, setFullImageLoaded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  useEffect(() => {
    if (!open || !deviceId) return;
    setLoading(true);
    setAllImages([]);
    setPage(1);
    setFilter("all");

    const unsub = onValue(ref(db, `gallery/${deviceId}`), (snap) => {
      const arr = parseSnap(snap.val());
      arr.sort((a, b) => b.timestamp - a.timestamp || b.key.localeCompare(a.key));
      setAllImages(arr);
      setLoading(false);
    });

    return () => unsub();
  }, [open, deviceId]);

  const filteredImages = useMemo(
    () => (filter === "pinned" ? allImages.filter((i) => i.pinned) : allImages),
    [allImages, filter]
  );

  const totalPages = Math.max(1, Math.ceil(filteredImages.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageImages = filteredImages.slice(pageStart, pageStart + PAGE_SIZE);
  const pinnedCount = useMemo(() => allImages.filter((i) => i.pinned).length, [allImages]);
  const totalCount = allImages.length;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const goToPage = useCallback((next: number) => {
    setPage(Math.max(1, Math.min(next, totalPages)));
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [totalPages]);

  const selectedImage = selectedIndex >= 0 && selectedIndex < pageImages.length ? pageImages[selectedIndex] : null;

  const selectImage = useCallback((img: GalleryImage) => {
    const idx = pageImages.findIndex((i) => i.key === img.key);
    setSelectedIndex(idx);
    setFullImageLoaded(false);
  }, [pageImages]);

  const goNext = useCallback(() => {
    setSelectedIndex((i) => {
      if (i < pageImages.length - 1) {
        setFullImageLoaded(false);
        return i + 1;
      }
      return i;
    });
  }, [pageImages.length]);

  const goPrev = useCallback(() => {
    setSelectedIndex((i) => {
      if (i > 0) {
        setFullImageLoaded(false);
        return i - 1;
      }
      return i;
    });
  }, []);

  const togglePin = useCallback(async (img: GalleryImage) => {
    const newPinned = !img.pinned;
    await update(ref(db, `gallery/${deviceId}/${img.key}`), { pinned: newPinned });
    setAllImages((prev) => prev.map((i) => (i.key === img.key ? { ...i, pinned: newPinned } : i)));
  }, [deviceId]);

  const handleTouchStart = useCallback((e: ReactTouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: ReactTouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchDeltaX.current > 60) goPrev();
    else if (touchDeltaX.current < -60) goNext();
    touchDeltaX.current = 0;
  }, [goNext, goPrev]);

  const pageList = useMemo(() => buildPageList(safePage, totalPages), [safePage, totalPages]);

  if (!open) return null;

  if (selectedImage) {
    return (
      <div className="fixed inset-0 z-[60] bg-background flex flex-col animate-in fade-in duration-200">
        <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/60 bg-background">
          <button
            onClick={() => setSelectedIndex(-1)}
            className="h-10 w-10 rounded-2xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-all duration-200 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div className="flex-1 text-center min-w-0 px-3">
            <p className="text-xs text-foreground font-semibold truncate">{selectedImage.local || "Image"}</p>
            <p className="text-[10px] text-muted-foreground">
              {selectedIndex + 1} / {pageImages.length} · {format(new Date(selectedImage.timestamp), "MMM d, yyyy · HH:mm:ss")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => togglePin(selectedImage)}
              className={`h-10 w-10 rounded-2xl border flex items-center justify-center transition-all duration-200 active:scale-95 ${
                selectedImage.pinned
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {selectedImage.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
            <button
              onClick={async () => {
                const imgKey = selectedImage.key;
                await remove(ref(db, `gallery/${deviceId}/${imgKey}`));
                setSelectedIndex(-1);
                setAllImages((prev) => prev.filter((i) => i.key !== imgKey));
              }}
              className="h-10 w-10 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center hover:bg-destructive/20 transition-all duration-200 active:scale-95"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
            <a
              href={selectedImage.full}
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 w-10 rounded-2xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-all duration-200 active:scale-95"
            >
              <Download className="h-4 w-4 text-foreground" />
            </a>
          </div>
        </header>
        <div
          className="flex-1 flex items-center justify-center p-4 overflow-hidden relative"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {!fullImageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center z-0">
              <div className="h-10 w-10 border-[3px] border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}
          <img
            src={selectedImage.full}
            alt={selectedImage.local || "Full image"}
            className={`max-w-full max-h-full object-contain rounded-2xl shadow-2xl transition-opacity duration-300 ${fullImageLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setFullImageLoaded(true)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-300">
      <header className="shrink-0 px-4 pt-4 pb-3 border-b border-border/60">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-2xl bg-card border border-border flex items-center justify-center hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
              <ImageIcon className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-foreground">Gallery</h2>
              <p className="text-[10px] text-muted-foreground">
                {totalCount > 0 ? `${totalCount} images` : "No images"}
                {pinnedCount > 0 && ` · ${pinnedCount} pinned`}
                {totalPages > 1 && ` · Page ${safePage}/${totalPages}`}
              </p>
            </div>
          </div>
        </div>

        {pinnedCount > 0 && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => { setFilter("all"); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                filter === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <ImageIcon className="h-3 w-3" />
              All ({totalCount})
            </button>
            <button
              onClick={() => { setFilter("pinned"); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                filter === "pinned"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Star className="h-3 w-3" />
              Pinned ({pinnedCount})
            </button>
          </div>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <div className="h-10 w-10 border-[3px] border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground font-medium">Loading gallery...</p>
          </div>
        ) : pageImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              {filter === "pinned" ? <Pin className="h-7 w-7 text-muted-foreground/40" /> : <ImageIcon className="h-7 w-7 text-muted-foreground/40" />}
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              {filter === "pinned" ? "No pinned images" : "No images found"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {pageImages.map((img) => (
              <ImageCard key={img.key} img={img} onClick={() => selectImage(img)} />
            ))}
          </div>
        )}
      </div>

      {!loading && totalPages > 1 && (
        <div className="shrink-0 border-t border-border/60 bg-background/95 backdrop-blur-sm px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+5rem)] lg:pb-3">
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <button
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage === 1}
              className="h-9 w-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageList.map((p, idx) =>
              p === "..." ? (
                <span key={`dots-${idx}`} className="px-1 text-[11px] font-bold text-muted-foreground">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className={`h-9 min-w-[36px] px-2 rounded-xl text-[11px] font-bold transition-all active:scale-95 ${
                    p === safePage
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/30"
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage === totalPages}
              className="h-9 w-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GalleryModal;
