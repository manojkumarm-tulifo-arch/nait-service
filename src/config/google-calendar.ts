/**
 * Google Calendar API client singleton.
 *
 * Lazily initialised on first call to getCalendarClient(). Supports two
 * authentication modes controlled by GOOGLE_AUTH_MODE:
 *
 *   - "service-account" (default): reads a JSON key file from disk.
 *     The service account must be shared on the target calendar.
 *
 *   - "oauth": uses a pre-obtained refresh token (useful for personal
 *     calendars where service account delegation isn't available).
 */

import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import fs from 'node:fs';
import { config } from './index.js';
import { CalendarError } from '../lib/errors.js';

let calendarClient: calendar_v3.Calendar | null = null;

export function getCalendarClient(): calendar_v3.Calendar {
  if (calendarClient) {
    return calendarClient;
  }

  try {
    if (config.GOOGLE_AUTH_MODE === 'oauth') {
      if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET || !config.GOOGLE_REFRESH_TOKEN) {
        throw new Error('OAuth mode requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN');
      }

      const oauth2Client = new google.auth.OAuth2(
        config.GOOGLE_CLIENT_ID,
        config.GOOGLE_CLIENT_SECRET,
      );
      oauth2Client.setCredentials({ refresh_token: config.GOOGLE_REFRESH_TOKEN });

      calendarClient = google.calendar({ version: 'v3', auth: oauth2Client });
    } else {
      // Service account mode — read the JSON key file synchronously (runs once at init)
      if (!config.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
        throw new Error('Service account mode requires GOOGLE_SERVICE_ACCOUNT_KEY_PATH');
      }

      const keyFileContent = fs.readFileSync(config.GOOGLE_SERVICE_ACCOUNT_KEY_PATH, 'utf-8');
      const credentials = JSON.parse(keyFileContent);

      const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });

      calendarClient = google.calendar({ version: 'v3', auth });
    }

    return calendarClient;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new CalendarError(`Failed to initialize Google Calendar client: ${message}`);
  }
}

/** Reset the cached client — primarily used in tests. */
export function resetCalendarClient(): void {
  calendarClient = null;
}
