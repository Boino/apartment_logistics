import * as React from 'react'
import { Badge } from './badge'
import type { BadgeProps } from './badge'

type StatusVariant = BadgeProps['variant']

const STATUS_MAP: Record<string, { label: string; variant: StatusVariant }> = {
  // ListingStatus
  DRAFT: { label: 'Draft', variant: 'secondary' },
  PUBLISHED: { label: 'Published', variant: 'success' },
  ARCHIVED: { label: 'Archived', variant: 'outline' },
  // InquiryStatus
  OPEN: { label: 'Open', variant: 'info' },
  ANSWERED: { label: 'Answered', variant: 'warning' },
  CONFIRMED: { label: 'Confirmed', variant: 'success' },
  DECLINED: { label: 'Declined', variant: 'destructive' },
  CLOSED: { label: 'Closed', variant: 'outline' },
  // StayStatus
  UPCOMING: { label: 'Upcoming', variant: 'info' },
  IN_HOUSE: { label: 'In House', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'secondary' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
  // SlotStatus
  REQUESTED: { label: 'Requested', variant: 'warning' },
  ACCEPTED: { label: 'Accepted', variant: 'success' },
  IN_PROGRESS: { label: 'In Progress', variant: 'info' },
  DONE: { label: 'Done', variant: 'success' },
  // AssignmentStatus
  INVITED: { label: 'Invited', variant: 'warning' },
  ACTIVE: { label: 'Active', variant: 'success' },
  REVOKED: { label: 'Revoked', variant: 'destructive' },
  // ReportStatus
  ACKNOWLEDGED: { label: 'Acknowledged', variant: 'warning' },
  RESOLVED: { label: 'Resolved', variant: 'success' },
  // LinenState
  STORED_CLEAN: { label: 'Clean', variant: 'success' },
  IN_USE: { label: 'In Use', variant: 'info' },
  STORED_DIRTY: { label: 'Dirty', variant: 'warning' },
  AT_LAUNDRY: { label: 'At Laundry', variant: 'purple' },
  // StockLevel
  FULL: { label: 'Full', variant: 'success' },
  OK: { label: 'OK', variant: 'success' },
  LOW: { label: 'Low', variant: 'warning' },
  EMPTY: { label: 'Empty', variant: 'destructive' },
}

interface StatusPillProps {
  status: string
  className?: string
}

export function StatusPill({ status, className }: StatusPillProps) {
  const config = STATUS_MAP[status] ?? { label: status, variant: 'secondary' as StatusVariant }
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}
