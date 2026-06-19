'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { DayPicker, type DateRange } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Modal, ModalContent } from './modal'

interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  fromDate?: Date
}

export function DatePicker({ value, onChange, placeholder = 'Pick a date', disabled, fromDate }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {value ? format(value, 'PPP') : placeholder}
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent className="w-auto p-0">
          <DayPicker
            mode="single"
            selected={value}
            onSelect={(d) => { onChange?.(d); setOpen(false) }}
            fromDate={fromDate}
            className="p-4"
          />
        </ModalContent>
      </Modal>
    </>
  )
}

interface DateRangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  placeholder?: string
  disabled?: boolean
  fromDate?: Date
}

export function DateRangePicker({ value, onChange, placeholder = 'Pick a date range', disabled, fromDate }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  const label = value?.from
    ? value.to
      ? `${format(value.from, 'PP')} – ${format(value.to, 'PP')}`
      : format(value.from, 'PP')
    : placeholder

  return (
    <>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn('w-full justify-start text-left font-normal', !value?.from && 'text-muted-foreground')}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {label}
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent className="w-auto p-0">
          <DayPicker
            mode="range"
            selected={value}
            onSelect={onChange}
            fromDate={fromDate}
            numberOfMonths={2}
            className="p-4"
          />
          <div className="flex justify-end p-4 pt-0">
            <Button size="sm" onClick={() => setOpen(false)}>Done</Button>
          </div>
        </ModalContent>
      </Modal>
    </>
  )
}
