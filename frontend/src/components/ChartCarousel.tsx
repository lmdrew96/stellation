import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AstrolabeRing } from './AstrolabeRing'

export interface ChartCarouselSlide {
  label: string
  url: string
}

interface ChartCarouselProps {
  slides: ChartCarouselSlide[]
  name: string
  artLabel?: string
}

const DOWNLOAD_PNG_SIZE = 1200

function downloadFilename(name: string, label: string, extension: string): string {
  const safeName = name.replace(/[^a-z0-9 &-]/gi, '').trim() || 'chart'
  return `${safeName} - ${label}.${extension}`
}

// The on-screen art is an SVG (see the <object> below), but a shared,
// fixed-size PNG is what's actually useful once it leaves the app - social
// posts, printing, anywhere a vector file isn't a safe assumption. Rendering
// this in the browser (rather than adding a second backend endpoint) means
// one implementation covers every reveal type that uses this carousel, and
// costs no extra network round-trip: `url` is already a same-origin blob
// URL for the SVG that's on screen, so decoding it into an <img> and
// drawing that onto a canvas never taints the canvas.
function svgUrlToPngBlob(url: string, size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, size, size)
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob produced no data'))
      }, 'image/png')
    }
    img.onerror = () => reject(new Error('Failed to load chart art for PNG conversion'))
    img.src = url
  })
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function ChartCarousel({ slides, name, artLabel = 'natal chart' }: ChartCarouselProps) {
  const [index, setIndex] = useState(0)
  const [magnified, setMagnified] = useState(false)
  const slide = slides[index]

  function go(delta: number) {
    setIndex((i) => (i + delta + slides.length) % slides.length)
  }

  async function handleDownload() {
    try {
      const pngBlob = await svgUrlToPngBlob(slide.url, DOWNLOAD_PNG_SIZE)
      const pngUrl = URL.createObjectURL(pngBlob)
      triggerDownload(pngUrl, downloadFilename(name, slide.label, 'png'))
      URL.revokeObjectURL(pngUrl)
    } catch {
      // PNG conversion is a browser-side extra step on top of art that's
      // already loaded and on screen - if it fails for some reason, falling
      // back to the original SVG beats leaving the download button dead.
      triggerDownload(slide.url, downloadFilename(name, slide.label, 'svg'))
    }
  }

  // .chart-frame carries `transform: rotate(-2.5deg)` for the scrapbook
  // tilt, which makes it a containing block for position:fixed descendants -
  // a plain overlay nested in the normal tree would render rotated and
  // clipped to that small card instead of covering the viewport. Portaling
  // to document.body sidesteps that regardless of what transforms exist
  // anywhere else up the reveal-component tree.
  useEffect(() => {
    if (!magnified) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMagnified(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [magnified])

  const artAlt = `${name}'s ${artLabel} - ${slide.label}`

  return (
    <div className="chart-carousel">
      <div className="chart-frame">
        <span className="tape tape--tl" aria-hidden="true" />
        <span className="tape tape--tr" aria-hidden="true" />
        <AstrolabeRing size={480} />
        {/* <object>, not <img>: the rendered SVG carries per-pattern <title>
            tooltips (see backend/app/services/render.py's _inject_svg_titles) -
            those only produce native hover tooltips when the SVG is a live
            nested document, which <img> never provides no matter what the
            SVG itself contains. The nested <img> is the fallback for the
            rare case the object embed itself fails to load. */}
        <object className="chart-art" type="image/svg+xml" data={slide.url} aria-label={artAlt}>
          <img className="chart-art" src={slide.url} alt={artAlt} />
        </object>
        {/* A button wrapping the <object> can't catch this click - <object>
            embeds a nested browsing context (its own Document), so clicks on
            the rendered SVG never bubble out to the host document at all.
            An invisible button laid exactly over it, matching .chart-art's
            box via inset:0, intercepts the click before it ever reaches the
            SVG's separate document. */}
        <button
          type="button"
          className="chart-art-trigger"
          onClick={() => setMagnified(true)}
          aria-label={`Magnify ${artAlt}`}
        />
        {magnified &&
          createPortal(
            <div
              className="chart-magnify-overlay"
              role="dialog"
              aria-modal="true"
              aria-label={`${artAlt}, magnified`}
              onClick={() => setMagnified(false)}
            >
              <button
                type="button"
                className="chart-magnify-close"
                onClick={() => setMagnified(false)}
                aria-label="Close magnified view"
              >
                ✕
              </button>
              <object
                className="chart-art chart-art--magnified"
                type="image/svg+xml"
                data={slide.url}
                aria-label={artAlt}
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  className="chart-art chart-art--magnified"
                  src={slide.url}
                  alt={artAlt}
                  onClick={(e) => e.stopPropagation()}
                />
              </object>
            </div>,
            document.body
          )}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              className="carousel-arrow carousel-arrow--prev"
              onClick={() => go(-1)}
              aria-label="Previous chart style"
            >
              ‹
            </button>
            <button
              type="button"
              className="carousel-arrow carousel-arrow--next"
              onClick={() => go(1)}
              aria-label="Next chart style"
            >
              ›
            </button>
          </>
        )}
      </div>
      <div className="carousel-meta">
        {slides.length > 1 && (
          <>
            <p className="carousel-label">{slide.label}</p>
            <div className="carousel-dots">
              {slides.map((s, i) => (
                <button
                  type="button"
                  key={s.label}
                  className="carousel-dot"
                  data-active={i === index}
                  onClick={() => setIndex(i)}
                  aria-label={`Show ${s.label} chart`}
                />
              ))}
            </div>
          </>
        )}
        <button type="button" className="carousel-download" onClick={handleDownload}>
          Download art
        </button>
      </div>
    </div>
  )
}
