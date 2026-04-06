import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the google-calendar config module before importing the service
const mockFreebusyQuery = vi.fn();
const mockEventsInsert = vi.fn();
const mockEventsDelete = vi.fn();

vi.mock('../config/google-calendar.js', () => ({
  getCalendarClient: () => ({
    freebusy: { query: mockFreebusyQuery },
    events: { insert: mockEventsInsert, delete: mockEventsDelete },
  }),
}));

import { getAvailableSlots, isSlotAvailable, createEvent, deleteEvent } from './calendar.service.js';

const CALENDAR_ID = 'test-calendar@group.calendar.google.com';

describe('Calendar Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAvailableSlots', () => {
    it('should return all slots when no busy periods', async () => {
      mockFreebusyQuery.mockResolvedValueOnce({
        data: { calendars: { [CALENDAR_ID]: { busy: [] } } },
      });

      // Use future dates
      const windowStart = new Date('2099-01-01T09:00:00Z');
      const windowEnd = new Date('2099-01-01T12:00:00Z');

      const slots = await getAvailableSlots(CALENDAR_ID, windowStart, windowEnd, 60);

      expect(slots).toHaveLength(3);
      expect(slots[0]).toMatchObject({ start: '2099-01-01T09:00:00.000Z', end: '2099-01-01T10:00:00.000Z', available: true });
    });

    it('should mark busy periods as unavailable', async () => {
      mockFreebusyQuery.mockResolvedValueOnce({
        data: {
          calendars: {
            [CALENDAR_ID]: {
              busy: [
                { start: '2099-01-01T10:00:00Z', end: '2099-01-01T11:00:00Z' },
              ],
            },
          },
        },
      });

      const windowStart = new Date('2099-01-01T09:00:00Z');
      const windowEnd = new Date('2099-01-01T12:00:00Z');

      const slots = await getAvailableSlots(CALENDAR_ID, windowStart, windowEnd, 60);

      expect(slots).toHaveLength(3);
      expect(slots[0]).toMatchObject({ start: '2099-01-01T09:00:00.000Z', available: true });
      expect(slots[1]).toMatchObject({ start: '2099-01-01T10:00:00.000Z', available: false });
      expect(slots[2]).toMatchObject({ start: '2099-01-01T11:00:00.000Z', available: true });
    });

    it('should filter out past slots', async () => {
      mockFreebusyQuery.mockResolvedValueOnce({
        data: { calendars: { [CALENDAR_ID]: { busy: [] } } },
      });

      const pastStart = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      const pastEnd = new Date(Date.now() - 1 * 60 * 60 * 1000);   // 1 hour ago

      const slots = await getAvailableSlots(CALENDAR_ID, pastStart, pastEnd, 30);

      expect(slots).toHaveLength(0);
    });

    it('should throw CalendarError on API failure', async () => {
      mockFreebusyQuery.mockRejectedValueOnce(new Error('API Error'));

      const windowStart = new Date('2099-01-01T09:00:00Z');
      const windowEnd = new Date('2099-01-01T12:00:00Z');

      await expect(getAvailableSlots(CALENDAR_ID, windowStart, windowEnd, 60))
        .rejects.toThrow('Failed to fetch available slots');
    });
  });

  describe('isSlotAvailable', () => {
    it('should return true when no busy periods overlap', async () => {
      mockFreebusyQuery.mockResolvedValueOnce({
        data: { calendars: { [CALENDAR_ID]: { busy: [] } } },
      });

      const result = await isSlotAvailable(
        CALENDAR_ID,
        new Date('2099-01-01T10:00:00Z'),
        new Date('2099-01-01T11:00:00Z'),
      );

      expect(result).toBe(true);
    });

    it('should return false when slot is busy', async () => {
      mockFreebusyQuery.mockResolvedValueOnce({
        data: {
          calendars: {
            [CALENDAR_ID]: {
              busy: [{ start: '2099-01-01T10:00:00Z', end: '2099-01-01T11:00:00Z' }],
            },
          },
        },
      });

      const result = await isSlotAvailable(
        CALENDAR_ID,
        new Date('2099-01-01T10:00:00Z'),
        new Date('2099-01-01T11:00:00Z'),
      );

      expect(result).toBe(false);
    });
  });

  describe('createEvent', () => {
    it('should create an event and return event details', async () => {
      mockEventsInsert.mockResolvedValueOnce({
        data: {
          id: 'event-123',
          summary: 'Interview with John',
          start: { dateTime: '2099-01-01T10:00:00Z' },
          end: { dateTime: '2099-01-01T11:00:00Z' },
        },
      });

      const result = await createEvent(
        CALENDAR_ID,
        'Interview with John',
        'Scheduled via Tulifo',
        new Date('2099-01-01T10:00:00Z'),
        new Date('2099-01-01T11:00:00Z'),
        'john@example.com',
      );

      expect(result.eventId).toBe('event-123');
      expect(result.summary).toBe('Interview with John');
      expect(mockEventsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: CALENDAR_ID,
          requestBody: expect.objectContaining({
            summary: 'Interview with John',
            attendees: [{ email: 'john@example.com' }],
          }),
        }),
      );
    });
  });

  describe('deleteEvent', () => {
    it('should delete an event', async () => {
      mockEventsDelete.mockResolvedValueOnce({});

      await deleteEvent(CALENDAR_ID, 'event-123');

      expect(mockEventsDelete).toHaveBeenCalledWith({
        calendarId: CALENDAR_ID,
        eventId: 'event-123',
      });
    });

    it('should handle already-deleted events (404)', async () => {
      mockEventsDelete.mockRejectedValueOnce({ code: 404, message: 'Not Found' });

      await expect(deleteEvent(CALENDAR_ID, 'event-123')).resolves.toBeUndefined();
    });

    it('should throw CalendarError on other failures', async () => {
      mockEventsDelete.mockRejectedValueOnce(new Error('Server Error'));

      await expect(deleteEvent(CALENDAR_ID, 'event-123'))
        .rejects.toThrow('Failed to delete calendar event');
    });
  });
});
