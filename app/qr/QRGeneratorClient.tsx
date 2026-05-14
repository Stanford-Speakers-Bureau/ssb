"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";

const PREVIEW_SIZE = 320;
const LOGO_FRACTION_DEFAULT = 0.22;
const LOGO_FRACTION_MIN = 0.1;
const LOGO_FRACTION_MAX = 0.3;
const HALO_PADDING = 0.04;
const LOGO_SRC = "/logo.png";

const SIZE_PRESETS = [
  { label: "Small", value: 512 },
  { label: "Medium", value: 1024 },
  { label: "Large", value: 2048 },
];

type Palette = {
  name: string;
  fg: string;
  bg: string;
  transparent?: boolean;
};

const PALETTES: Palette[] = [
  { name: "Classic", fg: "#0A0A0A", bg: "#FFFFFF" },
  { name: "Cardinal", fg: "#800A0A", bg: "#FFFFFF" },
  { name: "Midnight", fg: "#F5EFE6", bg: "#100B0A" },
  { name: "Transparent", fg: "#0A0A0A", bg: "#FFFFFF", transparent: true },
];

const HEX_RE = /^#?[0-9A-Fa-f]{0,8}$/;

function safeFilename(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "qr-code";
  try {
    const host = new URL(trimmed).hostname;
    if (host) return `qr-${host.replace(/^www\./, "")}`;
  } catch {
    // fall through to slug
  }
  return (
    "qr-" +
    trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "qr-code"
  );
}

function normalizeHex(input: string): string | null {
  const trimmed = input.trim().replace(/^#/, "");
  if (!/^[0-9A-Fa-f]+$/.test(trimmed)) return null;
  if (trimmed.length === 3) {
    return (
      "#" +
      trimmed
        .split("")
        .map((c) => c + c)
        .join("")
        .toUpperCase()
    );
  }
  if (trimmed.length === 6) return "#" + trimmed.toUpperCase();
  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function QRGeneratorClient() {
  const [value, setValue] = useState("https://stanfordspeakersbureau.com");
  const [fgColor, setFgColor] = useState("#0A0A0A");
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [transparent, setTransparent] = useState(false);
  const [showLogo, setShowLogo] = useState(true);
  const [logoFraction, setLogoFraction] = useState(LOGO_FRACTION_DEFAULT);
  const [downloadSize, setDownloadSize] = useState(1024);
  const [copied, setCopied] = useState(false);
  const [fgHexDraft, setFgHexDraft] = useState("#0A0A0A");
  const [bgHexDraft, setBgHexDraft] = useState("#FFFFFF");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenSvgRef = useRef<SVGSVGElement | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(LOGO_SRC)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          }),
      )
      .then(async (url) => {
        if (cancelled) return;
        setLogoDataUrl(url);
        try {
          logoImgRef.current = await loadImage(url);
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // fall back to using the public path directly
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const encoded = value.trim();
  const hasValue = encoded.length > 0;
  const effectiveBg = transparent ? "transparent" : bgColor;

  const activePalette = useMemo(() => {
    return PALETTES.find(
      (p) =>
        p.fg.toUpperCase() === fgColor.toUpperCase() &&
        p.bg.toUpperCase() === bgColor.toUpperCase() &&
        !!p.transparent === transparent,
    );
  }, [fgColor, bgColor, transparent]);

  const updateFg = useCallback((next: string) => {
    const upper = next.toUpperCase();
    setFgColor(upper);
    setFgHexDraft(upper);
  }, []);

  const updateBg = useCallback((next: string) => {
    const upper = next.toUpperCase();
    setBgColor(upper);
    setBgHexDraft(upper);
  }, []);

  const applyPalette = useCallback(
    (p: Palette) => {
      updateFg(p.fg);
      updateBg(p.bg);
      setTransparent(!!p.transparent);
    },
    [updateFg, updateBg],
  );

  const commitHex = useCallback(
    (which: "fg" | "bg", draft: string) => {
      const normalized = normalizeHex(draft);
      if (!normalized) {
        if (which === "fg") setFgHexDraft(fgColor);
        else setBgHexDraft(bgColor);
        return;
      }
      if (which === "fg") updateFg(normalized);
      else updateBg(normalized);
    },
    [fgColor, bgColor, updateFg, updateBg],
  );

  const drawCircularLogo = useCallback(
    async (
      ctx: CanvasRenderingContext2D,
      size: number,
      isTransparent: boolean,
      halo: string,
    ) => {
      let img = logoImgRef.current;
      if (!img) {
        try {
          img = await loadImage(logoDataUrl ?? LOGO_SRC);
        } catch {
          return;
        }
      }
      const cx = size / 2;
      const cy = size / 2;
      const logoR = (size * logoFraction) / 2;
      const haloR = logoR + (size * HALO_PADDING) / 2;

      if (!isTransparent) {
        ctx.save();
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, haloR, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      }
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, logoR, 0, 2 * Math.PI);
      ctx.clip();
      ctx.drawImage(img, cx - logoR, cy - logoR, 2 * logoR, 2 * logoR);
      ctx.restore();
    },
    [logoDataUrl, logoFraction],
  );

  async function buildExportCanvas(): Promise<HTMLCanvasElement | null> {
    const source = hiddenCanvasRef.current;
    if (!source) return null;
    const target = document.createElement("canvas");
    target.width = source.width;
    target.height = source.height;
    const ctx = target.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0);
    if (showLogo) {
      await drawCircularLogo(ctx, target.width, transparent, effectiveBg);
    }
    return target;
  }

  async function downloadPng() {
    const target = await buildExportCanvas();
    if (!target) return;
    try {
      const dataUrl = target.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${safeFilename(encoded)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("PNG download failed", err);
    }
  }

  function downloadSvg() {
    const svg = hiddenSvgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    if (!clone.getAttribute("xmlns")) {
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
    const SVG_NS = "http://www.w3.org/2000/svg";
    const XLINK_NS = "http://www.w3.org/1999/xlink";

    if (showLogo) {
      const size = downloadSize;
      const cx = size / 2;
      const cy = size / 2;
      const logoR = (size * logoFraction) / 2;
      const haloR = logoR + (size * HALO_PADDING) / 2;

      let defs = clone.querySelector("defs");
      if (!defs) {
        defs = clone.ownerDocument!.createElementNS(SVG_NS, "defs");
        clone.insertBefore(defs, clone.firstChild);
      }

      const clipId = `ssb-logo-clip-${Math.random().toString(36).slice(2, 9)}`;
      const clipPath = clone.ownerDocument!.createElementNS(SVG_NS, "clipPath");
      clipPath.setAttribute("id", clipId);
      const clipCircle = clone.ownerDocument!.createElementNS(SVG_NS, "circle");
      clipCircle.setAttribute("cx", String(cx));
      clipCircle.setAttribute("cy", String(cy));
      clipCircle.setAttribute("r", String(logoR));
      clipPath.appendChild(clipCircle);
      defs.appendChild(clipPath);

      if (!transparent) {
        const halo = clone.ownerDocument!.createElementNS(SVG_NS, "circle");
        halo.setAttribute("cx", String(cx));
        halo.setAttribute("cy", String(cy));
        halo.setAttribute("r", String(haloR));
        halo.setAttribute("fill", effectiveBg);
        clone.appendChild(halo);
      }

      const image = clone.ownerDocument!.createElementNS(SVG_NS, "image");
      const href = logoDataUrl ?? LOGO_SRC;
      image.setAttribute("href", href);
      image.setAttributeNS(XLINK_NS, "xlink:href", href);
      image.setAttribute("x", String(cx - logoR));
      image.setAttribute("y", String(cy - logoR));
      image.setAttribute("width", String(2 * logoR));
      image.setAttribute("height", String(2 * logoR));
      image.setAttribute("preserveAspectRatio", "xMidYMid meet");
      image.setAttribute("clip-path", `url(#${clipId})`);
      clone.appendChild(image);
    }

    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob(
      [`<?xml version="1.0" encoding="UTF-8"?>\n`, serialized],
      { type: "image/svg+xml;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFilename(encoded)}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyPng() {
    try {
      const target = await buildExportCanvas();
      if (!target) return;
      const blob: Blob | null = await new Promise((resolve) =>
        target.toBlob(resolve, "image/png"),
      );
      if (!blob) return;
      const ClipboardItemCtor = (
        window as unknown as {
          ClipboardItem?: new (items: Record<string, Blob>) => unknown;
        }
      ).ClipboardItem;
      if (!ClipboardItemCtor || !navigator.clipboard?.write) return;
      await navigator.clipboard.write([
        new ClipboardItemCtor({ "image/png": blob }) as ClipboardItem,
      ]);
      setCopied(true);
    } catch (err) {
      console.error("Copy failed", err);
    }
  }

  const previewBoxStyle = transparent
    ? ({
      backgroundColor: "transparent",
      backgroundImage:
        "linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.08) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.08) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.08) 75%)",
      backgroundSize: "14px 14px",
      backgroundPosition: "0 0, 0 7px, 7px -7px, -7px 0px",
    } as React.CSSProperties)
    : ({ backgroundColor: bgColor } as React.CSSProperties);

  const previewBgQR = transparent ? "transparent" : bgColor;

  return (
    <div className="min-h-screen px-4 py-16 sm:py-20 bg-[var(--ssb-paper)] text-[var(--ssb-ink)]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 sm:mb-12 text-center">
          <h1 className="mt-4 font-serif text-4xl sm:text-5xl text-white">
            QR Code Generator
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[var(--ssb-muted)]">
            Paste any link, style it, and download a QR code with the SSB mark
            in the center.
          </p>
        </div>

        <div className="rounded-3xl border border-[var(--ssb-border)] bg-[var(--ssb-card)]/80 p-5 sm:p-8 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur-sm">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="flex flex-col gap-6 order-2 lg:order-1">
              <Field label="Link">
                <input
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full rounded-xl border border-[var(--ssb-border)] bg-[var(--ssb-paper-strong)] px-4 py-3 text-base text-[var(--ssb-ink)] placeholder-[var(--ssb-muted)]/60 transition-colors focus:border-[var(--ssb-accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ssb-accent-soft)]"
                />
                <span className="mt-2 block text-xs text-[var(--ssb-muted)]">
                  Any URL works — http, https, mailto, tel, or a plain string.
                </span>
              </Field>

              <Field label="Style">
                <div className="flex flex-wrap gap-2">
                  {PALETTES.map((p) => {
                    const active = activePalette?.name === p.name;
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => applyPalette(p)}
                        className={`group flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${active
                          ? "border-[var(--ssb-accent-strong)] bg-[var(--ssb-accent-soft)] text-white"
                          : "border-[var(--ssb-border)] bg-[var(--ssb-paper-strong)] text-[var(--ssb-ink)] hover:border-[var(--ssb-accent-strong)]/60"
                          }`}
                      >
                        <PaletteChip palette={p} />
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Colors">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ColorRow
                    label="Foreground"
                    color={fgColor}
                    hexDraft={fgHexDraft}
                    onColorChange={updateFg}
                    onHexDraftChange={setFgHexDraft}
                    onCommit={() => commitHex("fg", fgHexDraft)}
                  />
                  <ColorRow
                    label="Background"
                    color={bgColor}
                    hexDraft={bgHexDraft}
                    onColorChange={updateBg}
                    onHexDraftChange={setBgHexDraft}
                    onCommit={() => commitHex("bg", bgHexDraft)}
                    disabled={transparent}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setTransparent((v) => !v)}
                        className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${transparent
                          ? "border-[var(--ssb-accent-strong)] bg-[var(--ssb-accent-soft)] text-white"
                          : "border-[var(--ssb-border)] bg-[var(--ssb-paper-strong)] text-[var(--ssb-muted)] hover:border-[var(--ssb-accent-strong)]/60"
                          }`}
                        aria-pressed={transparent}
                      >
                        Transparent
                      </button>
                    }
                  />
                </div>
              </Field>

              <Field label="Center mark">
                <div className="rounded-xl border border-[var(--ssb-border)] bg-[var(--ssb-paper-strong)] px-3 py-2.5">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={showLogo}
                      onChange={(e) => setShowLogo(e.target.checked)}
                      className="h-4 w-4 cursor-pointer accent-[var(--ssb-accent-strong)]"
                    />
                    <span className="flex items-center gap-2 text-sm text-[var(--ssb-ink)]">
                      <span className="relative inline-flex h-6 w-6 overflow-hidden rounded-full ring-1 ring-[var(--ssb-border)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={LOGO_SRC}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </span>
                      Show SSB logo in the center
                    </span>
                  </label>
                  <div
                    className={`mt-3 flex items-center gap-3 transition-opacity ${showLogo ? "" : "opacity-40"}`}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ssb-muted)]">
                      Size
                    </span>
                    <input
                      type="range"
                      min={Math.round(LOGO_FRACTION_MIN * 100)}
                      max={Math.round(LOGO_FRACTION_MAX * 100)}
                      step={1}
                      value={Math.round(logoFraction * 100)}
                      onChange={(e) =>
                        setLogoFraction(Number(e.target.value) / 100)
                      }
                      disabled={!showLogo}
                      className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--ssb-border)] outline-none accent-[var(--ssb-accent-strong)] disabled:cursor-not-allowed"
                      aria-label="Logo size"
                    />
                    <span className="w-10 text-right font-mono text-xs tabular-nums text-[var(--ssb-ink)]">
                      {Math.round(logoFraction * 100)}%
                    </span>
                  </div>
                </div>
              </Field>

              <Field label="Download size">
                <div className="flex flex-wrap gap-2">
                  {SIZE_PRESETS.map((preset) => {
                    const active = downloadSize === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setDownloadSize(preset.value)}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${active
                          ? "border-[var(--ssb-accent-strong)] bg-[var(--ssb-accent-soft)] text-white"
                          : "border-[var(--ssb-border)] bg-[var(--ssb-paper-strong)] text-[var(--ssb-ink)] hover:border-[var(--ssb-accent-strong)]/60"
                          }`}
                      >
                        {preset.label}
                        <span className="ml-1.5 text-xs opacity-70">
                          {preset.value}px
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={downloadPng}
                  disabled={!hasValue}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--ssb-accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--ssb-accent-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <DownloadIcon /> Download PNG
                </button>
                <button
                  type="button"
                  onClick={downloadSvg}
                  disabled={!hasValue}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--ssb-border)] bg-[var(--ssb-paper-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ssb-ink)] transition-colors hover:border-[var(--ssb-accent-strong)]/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <DownloadIcon /> Download SVG
                </button>
                <button
                  type="button"
                  onClick={copyPng}
                  disabled={!hasValue}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--ssb-border)] bg-[var(--ssb-paper-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ssb-ink)] transition-colors hover:border-[var(--ssb-accent-strong)]/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {copied ? "Copied!" : "Copy image"}
                </button>
              </div>
            </div>

            <div className="order-1 lg:order-2 flex flex-col items-center lg:items-end">
              <div className="rounded-2xl border border-[var(--ssb-border)] bg-[var(--ssb-paper-strong)] p-4 shadow-inner">
                <div
                  className="relative rounded-xl overflow-hidden"
                  style={{
                    ...previewBoxStyle,
                    width: PREVIEW_SIZE + 24,
                    height: PREVIEW_SIZE + 24,
                  }}
                >
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ padding: 12 }}
                  >
                    {hasValue ? (
                      <div
                        className="relative"
                        style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
                      >
                        <QRCodeCanvas
                          value={encoded}
                          size={PREVIEW_SIZE}
                          level="H"
                          marginSize={2}
                          fgColor={fgColor}
                          bgColor={previewBgQR}
                        />
                        {showLogo && (
                          <CircularLogoOverlay
                            qrSize={PREVIEW_SIZE}
                            haloColor={transparent ? null : bgColor}
                            fraction={logoFraction}
                          />
                        )}
                      </div>
                    ) : (
                      <div
                        className="flex items-center justify-center rounded-lg text-sm"
                        style={{
                          width: PREVIEW_SIZE,
                          height: PREVIEW_SIZE,
                          color: transparent
                            ? "var(--ssb-muted)"
                            : "rgba(0,0,0,0.5)",
                        }}
                      >
                        Enter a link to preview
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {hasValue && (
                <p className="mt-3 max-w-[320px] break-all text-center text-xs text-[var(--ssb-muted)] lg:text-right">
                  Scans to:{" "}
                  <span className="text-[var(--ssb-ink)]">{encoded}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {hasValue && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -99999,
            top: -99999,
            pointerEvents: "none",
          }}
        >
          <QRCodeCanvas
            ref={hiddenCanvasRef}
            value={encoded}
            size={downloadSize}
            level="H"
            marginSize={2}
            fgColor={fgColor}
            bgColor={transparent ? "transparent" : bgColor}
          />
          <QRCodeSVG
            ref={hiddenSvgRef}
            value={encoded}
            size={downloadSize}
            level="H"
            marginSize={2}
            fgColor={fgColor}
            bgColor={transparent ? "transparent" : bgColor}
          />
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ssb-muted)]">
        {label}
      </span>
      {children}
    </div>
  );
}

function ColorRow({
  label,
  color,
  hexDraft,
  onColorChange,
  onHexDraftChange,
  onCommit,
  disabled = false,
  trailing,
}: {
  label: string;
  color: string;
  hexDraft: string;
  onColorChange: (color: string) => void;
  onHexDraftChange: (s: string) => void;
  onCommit: () => void;
  disabled?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-[var(--ssb-border)] bg-[var(--ssb-paper-strong)] px-2.5 py-2 transition-opacity ${disabled ? "opacity-50" : ""}`}
    >
      <label
        className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-lg ring-1 ring-[var(--ssb-border)] focus-within:ring-[var(--ssb-accent-strong)]"
        title={`${label} color`}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{ backgroundColor: color }}
        />
        <input
          type="color"
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          disabled={disabled}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ssb-muted)]">
          {label}
        </span>
        <input
          type="text"
          value={hexDraft}
          onChange={(e) => {
            const v = e.target.value;
            if (HEX_RE.test(v) || v === "") onHexDraftChange(v);
          }}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          spellCheck={false}
          disabled={disabled}
          className="w-full bg-transparent font-mono text-sm text-[var(--ssb-ink)] outline-none placeholder-[var(--ssb-muted)]/50"
          placeholder="#000000"
        />
      </div>
      {trailing}
    </div>
  );
}

function PaletteChip({ palette }: { palette: Palette }) {
  if (palette.transparent) {
    return (
      <span
        className="relative inline-flex h-5 w-5 overflow-hidden rounded-md ring-1 ring-[var(--ssb-border)]"
        style={{
          backgroundImage:
            "linear-gradient(45deg, rgba(255,255,255,0.18) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.18) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.18) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.18) 75%)",
          backgroundSize: "6px 6px",
          backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0px",
        }}
      >
        <span
          className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm"
          style={{ backgroundColor: palette.fg }}
        />
      </span>
    );
  }
  return (
    <span className="relative inline-flex h-5 w-5 overflow-hidden rounded-md ring-1 ring-[var(--ssb-border)]">
      <span
        className="absolute inset-0"
        style={{ backgroundColor: palette.bg }}
      />
      <span
        className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm"
        style={{ backgroundColor: palette.fg }}
      />
    </span>
  );
}

function CircularLogoOverlay({
  qrSize,
  haloColor,
  fraction,
}: {
  qrSize: number;
  haloColor: string | null;
  fraction: number;
}) {
  const logoSize = qrSize * fraction;
  const haloSize = qrSize * (fraction + HALO_PADDING);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {haloColor && (
        <span
          aria-hidden="true"
          className="absolute rounded-full"
          style={{
            width: haloSize,
            height: haloSize,
            backgroundColor: haloColor,
          }}
        />
      )}
      <span
        className="relative overflow-hidden rounded-full"
        style={{ width: logoSize, height: logoSize }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_SRC}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      </span>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
