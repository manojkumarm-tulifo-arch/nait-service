/**
 * Google Calendar integration service.
 *
 * Provides four operations used by the verification flow:
 *   - getAvailableSlots: generate a slot grid from a scheduling window,
 *     marking each as available/blocked based on Google freebusy data.
 *     Slots are 1-hour blocks aligned to the local-time hour boundaries
 *     set by the admin's date picker (midnight local). Only slots starting
 *     at least 2 hours from now are returned, and past slots are skipped.
 *   - isSlotAvailable: point-in-time re-check before booking (race guard)
 *   - createEvent: book the interview on the calendar
 *   - deleteEvent: remove the event on session cancellation (idempotent)
 */

import { getCalendarClient } from '../config/google-calendar.js';
import { CalendarError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import type { TimeSlot, CalendarEvent } from './calendar.types.js';

/**
 * Build a grid of fixed-duration slots within the scheduling window and
 * mark each as available or blocked by querying Google Calendar freebusy.
 *
 * Slot alignment: the cursor starts directly from windowStart (set to local
 * midnight by the admin's date picker) so all slots fall on clean local-time
 * hour boundaries (12 AM, 1 AM, …, 11 PM). We intentionally do NOT snap to
 * UTC hour boundaries — doing so would misalign for timezones with non-hour
 * offsets (e.g. IST at UTC+5:30 would produce 12:30 AM slots).
 *
 * The 2-hour buffer ensures candidates cannot book a slot that starts within
 * the next 2 hours, giving them time to complete the remaining verification
 * steps before the interview.
 */
export async function getAvailableSlots(
  calendarId: string,
  windowStart: Date,
  windowEnd: Date,
  slotDurationMinutes: number,
): Promise<TimeSlot[]> {
  const calendar = getCalendarClient();
  const slotDurationMs = slotDurationMinutes * 60 * 1000;

  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: windowStart.toISOString(),
        timeMax: windowEnd.toISOString(),
        items: [{ id: calendarId }],
      },
    });

    const busyPeriods = response.data.calendars?.[calendarId]?.busy ?? [];

    // Pre-convert to epoch ms for fast overlap checks in the loop
    const busyRanges = busyPeriods.map((period) => ({
      start: new Date(period.start!).getTime(),
      end: new Date(period.end!).getTime(),
    }));

    const slots: TimeSlot[] = [];
    const now = Date.now();
    // Slots must start at least 2 hours from now
    const earliest = now + 2 * 60 * 60 * 1000;
    // Start from windowStart directly — the admin sets it to midnight local time,
    // so slots naturally align to local-time hour boundaries (12 AM, 1 AM, …).
    let cursor = windowStart.getTime();

    while (cursor + slotDurationMs <= windowEnd.getTime()) {
      const slotEnd = cursor + slotDurationMs;

      // Skip slots that start less than 2 hours from now
      if (cursor < earliest) {
        cursor += slotDurationMs;
        continue;
      }

      // Overlap check: slot [cursor, slotEnd) overlaps busy [start, end) iff cursor < end AND slotEnd > start
      const isBlocked = busyRanges.some(
        (busy) => cursor < busy.end && slotEnd > busy.start,
      );

      slots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(slotEnd).toISOString(),
        available: !isBlocked,
      });

      cursor += slotDurationMs;
    }

    logger.info(
      { calendarId, windowStart, windowEnd, slotDurationMinutes, totalSlots: slots.length },
      'Fetched available slots',
    );

    return slots;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ err, calendarId }, 'Failed to fetch available slots');
    throw new CalendarError(`Failed to fetch available slots: ${message}`);
  }
}

/**
 * Re-check a single slot's availability right before booking.
 * Guards against race conditions when multiple candidates view slots
 * simultaneously — one may book the slot between the other's GET and POST.
 */
export async function isSlotAvailable(
  calendarId: string,
  start: Date,
  end: Date,
): Promise<boolean> {
  const calendar = getCalendarClient();

  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: calendarId }],
      },
    });

    const busyPeriods = response.data.calendars?.[calendarId]?.busy ?? [];
    return busyPeriods.length === 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new CalendarError(`Failed to check slot availability: ${message}`);
  }
}

/** Create a calendar event for the booked interview slot. */
export async function createEvent(
  calendarId: string,
  summary: string,
  description: string,
  start: Date,
  end: Date,
  attendeeEmail?: string,
): Promise<CalendarEvent> {
  const calendar = getCalendarClient();

  try {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary,
        description,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        ...(attendeeEmail && {
          attendees: [{ email: attendeeEmail }],
        }),
      },
    });

    const event = response.data;
    logger.info({ calendarId, eventId: event.id, summary }, 'Calendar event created');

    return {
      eventId: event.id!,
      summary: event.summary!,
      start: event.start?.dateTime ?? event.start?.date ?? start.toISOString(),
      end: event.end?.dateTime ?? event.end?.date ?? end.toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ err, calendarId }, 'Failed to create calendar event');
    throw new CalendarError(`Failed to create calendar event: ${message}`);
  }
}

/**
 * Delete a calendar event. Treats 404/410 as idempotent success —
 * the event may have already been removed manually or by Google retention.
 */
export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  const calendar = getCalendarClient();

  try {
    await calendar.events.delete({ calendarId, eventId });
    logger.info({ calendarId, eventId }, 'Calendar event deleted');
  } catch (err: unknown) {
    // 404 (not found) and 410 (gone) mean the event is already deleted — treat as success
    if (err && typeof err === 'object' && 'code' in err && (err.code === 404 || err.code === 410)) {
      logger.warn({ calendarId, eventId }, 'Calendar event already deleted');
      return;
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ err, calendarId, eventId }, 'Failed to delete calendar event');
    throw new CalendarError(`Failed to delete calendar event: ${message}`);
  }
}
