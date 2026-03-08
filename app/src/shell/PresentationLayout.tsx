import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { CozyThingText } from '@/CozyText'
import Slide1Cover from '@/components/presentation/Slide1Cover'
import Slide2Problem from '@/components/presentation/Slide2Problem'
import Slide3Solution from '@/components/presentation/Slide3Solution'
import Slide4Technology from '@/components/presentation/Slide4Technology'
import Slide4DemoVideo from '@/components/presentation/Slide4DemoVideo'
import Slide5BuiltIn3Days from '@/components/presentation/Slide5BuiltIn3Days'
import Slide7Scalability from '@/components/presentation/Slide7Scalability'
import Slide8Team from '@/components/presentation/Slide8Team'
import Slide9Partnership from '@/components/presentation/Slide9Partnership'

const slides = [
  Slide1Cover,
  Slide2Problem,
  Slide3Solution,
  Slide4Technology,
  Slide4DemoVideo,
  Slide5BuiltIn3Days,
  Slide7Scalability,
  Slide8Team,
  Slide9Partnership,
]

export default function PresentationLayout() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const navigate = useNavigate()

  const next = useCallback(() => {
    setCurrentSlide((s) => Math.min(s + 1, slides.length - 1))
  }, [])

  const prev = useCallback(() => {
    setCurrentSlide((s) => Math.max(s - 1, 0))
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        prev()
      } else if (e.key === 'Escape') {
        navigate('/')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [next, prev, navigate])

  const SlideComponent = slides[currentSlide]

  return (
    <div
      className="relative h-screen w-screen overflow-hidden"
      style={{ background: '#FFFFFF' }}
    >
      {/* Exit button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          navigate('/')
        }}
        className="absolute right-6 top-6 z-50 flex size-10 items-center justify-center rounded-full transition-colors hover:bg-black/5"
        style={{ color: 'rgba(0,0,0,0.3)' }}
      >
        <X size={20} />
      </button>

      {/* Current slide */}
      <div key={currentSlide} className="h-full w-full animate-fade-in">
        <SlideComponent />
      </div>

      {/* Clickable navigation overlays */}
      <div
        className="absolute inset-0 z-40"
        style={{ left: '0', right: '50%', pointerEvents: currentSlide === 4 ? 'none' : 'auto' }}
        onClick={prev}
      />
      <div
        className="absolute inset-0 z-40"
        style={{ left: '50%', right: '0', pointerEvents: currentSlide === 4 ? 'none' : 'auto' }}
        onClick={next}
      />

      {/* Slide counter */}
      <div
        className="absolute bottom-6 right-6 z-50 text-sm font-medium"
        style={{ color: 'rgba(0,0,0,0.3)', textShadow: 'none', filter: 'none', WebkitTextStroke: '0px' }}
      >
        {currentSlide + 1} / {slides.length}
      </div>

      {/* Footer */}
      {currentSlide !== 8 && (
        <div
          className="absolute bottom-5 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap text-sm"
          style={{ color: '#ccc' }}
        >
          Matilda &nbsp;&middot;&nbsp; powered by lm<CozyThingText text="thing" className="text-sm font-semibold" />
        </div>
      )}
    </div>
  )
}
