// String enum constants — mirrors what was in prisma/schema.prisma for PostgreSQL.
// SQLite doesn't support Prisma enums; these are plain string values stored in DB.

export const LocationPrecision = { EXACT: 'EXACT', AREA: 'AREA' } as const
export type LocationPrecision = (typeof LocationPrecision)[keyof typeof LocationPrecision]

export const ListingStatus = { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', ARCHIVED: 'ARCHIVED' } as const
export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus]

export const BlockStatus = { AVAILABLE: 'AVAILABLE', BLOCKED: 'BLOCKED', BOOKED: 'BOOKED' } as const
export type BlockStatus = (typeof BlockStatus)[keyof typeof BlockStatus]

export const InquiryStatus = {
  OPEN: 'OPEN', ANSWERED: 'ANSWERED', CONFIRMED: 'CONFIRMED', DECLINED: 'DECLINED', CLOSED: 'CLOSED',
} as const
export type InquiryStatus = (typeof InquiryStatus)[keyof typeof InquiryStatus]

export const StayStatus = { UPCOMING: 'UPCOMING', IN_HOUSE: 'IN_HOUSE', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' } as const
export type StayStatus = (typeof StayStatus)[keyof typeof StayStatus]

export const AssignmentStatus = { INVITED: 'INVITED', ACTIVE: 'ACTIVE', REVOKED: 'REVOKED' } as const
export type AssignmentStatus = (typeof AssignmentStatus)[keyof typeof AssignmentStatus]

export const SlotStatus = {
  REQUESTED: 'REQUESTED', ACCEPTED: 'ACCEPTED', DECLINED: 'DECLINED',
  IN_PROGRESS: 'IN_PROGRESS', DONE: 'DONE', CANCELLED: 'CANCELLED',
} as const
export type SlotStatus = (typeof SlotStatus)[keyof typeof SlotStatus]

export const LinenType = { SHEETS: 'SHEETS', TOWELS: 'TOWELS' } as const
export type LinenType = (typeof LinenType)[keyof typeof LinenType]

export const LinenState = { STORED_CLEAN: 'STORED_CLEAN', IN_USE: 'IN_USE', STORED_DIRTY: 'STORED_DIRTY', AT_LAUNDRY: 'AT_LAUNDRY' } as const
export type LinenState = (typeof LinenState)[keyof typeof LinenState]

export const StockLevel = { FULL: 'FULL', OK: 'OK', LOW: 'LOW', EMPTY: 'EMPTY' } as const
export type StockLevel = (typeof StockLevel)[keyof typeof StockLevel]

export const ReportStatus = { OPEN: 'OPEN', ACKNOWLEDGED: 'ACKNOWLEDGED', RESOLVED: 'RESOLVED' } as const
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus]
