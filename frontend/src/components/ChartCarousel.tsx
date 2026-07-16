import { useState } from 'react'
import { AstrolabeRing } from './AstrolabeRing'

export interface ChartCarouselSlide {
  label: string
  url: string
}

interface ChartCarouselProps {
  slides: ChartCarouselSlide[]
  name: string
}

function downloadFilename(name: string, label: string): string {
  const safeName = name.replace(/[^a-z0-9 &-]/gi, '').trim() || 'chart'
  return `${safeName} - ${label}.svg`
}

export function ChartCarousel({ slides, name }: ChartCarouselProps) {
  const [index, setIndex] = useState(0)
  const slide = slides[index]

  function go(delta: number) {
    setIndex((i) => (i + delta + slides.length) % slides.length)
  }

  return (
    <div className="chart-carousel">
      <div className="chart-frame">
        <AstrolabeRing size={480} />
        <img className="chart-art" src={slide.url} alt={`${name}'s natal chart - ${slide.label}`} />
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
        <a className="carousel-download" href={slide.url} download={downloadFilename(name, slide.label)}>
          Download art
        </a>
      </div>
    </div>
  )
}
