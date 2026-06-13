import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Step {
  label: string
  description?: string
}

interface StepperProps {
  steps: Step[]
  currentStep: number
  className?: string
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <ol className={cn('flex items-center', className)}>
      {steps.map((step, i) => {
        const done = i < currentStep
        const active = i === currentStep
        return (
          <li key={step.label} className={cn('flex items-center', i < steps.length - 1 && 'flex-1')}>
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium',
                  done && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary text-primary',
                  !done && !active && 'border-muted-foreground/30 text-muted-foreground',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn('mt-1 text-xs', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('mx-2 h-px flex-1', i < currentStep ? 'bg-primary' : 'bg-border')} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
