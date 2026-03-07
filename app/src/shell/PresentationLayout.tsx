import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import Slide1Cover from '@/components/presentation/Slide1Cover'
import Slide2Problem from '@/components/presentation/Slide2Problem'
import Slide3Solution from '@/components/presentation/Slide3Solution'
import Slide4Technology from '@/components/presentation/Slide4Technology'
import Slide5BuiltIn3Days from '@/components/presentation/Slide5BuiltIn3Days'
import Slide6Scalability from '@/components/presentation/Slide6Scalability'
import Slide7Team from '@/components/presentation/Slide7Team'

const slides = [
  Slide1Cover,
  Slide2Problem,
  Slide3Solution,
  Slide4Technology,
  Slide5BuiltIn3Days,
  Slide6Scalability,
  Slide7Team,
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
      style={{ background: '#141414' }}
      onClick={next}
    >
      {/* Exit button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          navigate('/')
        }}
        className="absolute right-6 top-6 z-50 flex size-10 items-center justify-center rounded-full transition-colors hover:bg-white/10"
        style={{ color: 'rgba(255,255,255,0.4)' }}
      >
        <X size={20} />
      </button>

      {/* Current slide */}
      <div key={currentSlide} className="h-full w-full animate-fade-in">
        <SlideComponent />
      </div>

      {/* Slide counter */}
      <div
        className="absolute bottom-6 right-6 z-50 text-sm font-medium"
        style={{ color: 'rgba(255,255,255,0.3)' }}
      >
        {currentSlide + 1} / {slides.length}
      </div>
    </div>
  )
}
