import { colors } from './constants'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'
import qrCode from '@/assets/qr-code.png'

export default function Slide8Partnership() {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center"
      style={{ background: colors.bg }}
    >
      <h1 className="text-center text-5xl font-bold leading-tight tracking-tight sm:text-7xl" style={{ color: colors.text }}>
        Are you building agents?
        <br />
        <br />
        Visit <span style={{ color: colors.brandDark   }}>lm</span><CozyThingText text="thing" className="text-5xl font-bold sm:text-7xl leading-loose" /><span style={{ color: colors.brandDark }}>.studio</span>
        <br />
        and join the community!
      </h1>

      <div className="mt-16 flex flex-col items-center">
        <img
          src={qrCode}
          alt="Scan to visit lmthing.studio"
          className="h-80 w-80 rounded-3xl shadow-xl"
          style={{ boxShadow: '0 10px 40px rgba(245, 166, 35, 0.2)' }}
        />
      </div>
    </div>
  )
}
