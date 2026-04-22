import '@lmthing/css/components/computer/boot-progress.css'
import { cn } from '../../lib/utils'

export type BootStage = 'booting' | 'connecting' | 'authenticating' | 'running' | 'error'

export interface BootProgressProps {
  tier: 'webcontainer' | 'flyio'
  stage: BootStage
}

const webcontainerSteps = [
  { key: 'booting', label: 'Starting WebContainer' },
  { key: 'running', label: 'Runtime ready' },
]

const flyioSteps = [
  { key: 'connecting', label: 'Connecting to Fly.io node' },
  { key: 'authenticating', label: 'Authenticating' },
  { key: 'running', label: 'Runtime ready' },
]

function getStepState(stepKey: string, currentStage: BootStage, steps: { key: string }[]): 'done' | 'active' | 'pending' {
  const currentIdx = steps.findIndex((s) => s.key === currentStage)
  const stepIdx = steps.findIndex((s) => s.key === stepKey)
  if (stepIdx < currentIdx) return 'done'
  if (stepIdx === currentIdx) return 'active'
  return 'pending'
}

function BootProgress({ tier, stage }: BootProgressProps) {
  if (stage === 'running') return null

  const steps = tier === 'flyio' ? flyioSteps : webcontainerSteps
  const label = tier === 'flyio'
    ? 'Connecting to your Computer node...'
    : 'Starting browser runtime...'

  return (
    <div className="computer-boot-progress">
      <div className="computer-boot-progress__spinner" />
      <span className="computer-boot-progress__label">{label}</span>
      <div className="computer-boot-progress__steps">
        {steps.map((step) => {
          const state = getStepState(step.key, stage, steps)
          return (
            <span
              key={step.key}
              className={cn(
                'computer-boot-progress__step',
                state === 'done' && 'computer-boot-progress__step--done',
                state === 'active' && 'computer-boot-progress__step--active',
              )}
            >
              {state === 'done' ? '\u2713' : state === 'active' ? '\u25CB' : '\u00B7'} {step.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export { BootProgress }
