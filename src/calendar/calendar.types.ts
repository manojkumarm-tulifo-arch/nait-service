/** A discrete bookable time window returned by the slot picker. */
export interface TimeSlot {
  start: string;      // ISO 8601 datetime
  end: string;        // ISO 8601 datetime
  available: boolean; // false when the slot overlaps a busy period
}

/** Normalised representation of a Google Calendar event. */
export interface CalendarEvent {
  eventId: string;
  summary: string;
  start: string;
  end: string;
}
