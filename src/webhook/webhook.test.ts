import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { dispatch } from './webhook.service.js';
import type { WebhookPayload } from './webhook.types.js';

vi.mock('axios');

const mockPayload: WebhookPayload = {
  eventType: 'invitation_sent',
  timestamp: new Date().toISOString(),
  sessionId: '507f1f77bcf86cd799439011',
  data: { schedulingLink: 'https://example.com/schedule/token123' },
};

describe('Webhook Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should dispatch successfully on first attempt', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ status: 200, data: {} });

    await dispatch('https://hooks.example.com', mockPayload);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      'https://hooks.example.com',
      mockPayload,
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  it('should retry on failure and succeed on second attempt', async () => {
    vi.mocked(axios.post)
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce({ status: 200, data: {} });

    await dispatch('https://hooks.example.com', mockPayload);

    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it('should exhaust retries and not throw', async () => {
    vi.mocked(axios.post)
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('fail 3'));

    await expect(dispatch('https://hooks.example.com', mockPayload)).resolves.toBeUndefined();

    expect(axios.post).toHaveBeenCalledTimes(3);
  });

  it('should handle timeout errors', async () => {
    const timeoutError = new Error('timeout of 5000ms exceeded');
    vi.mocked(axios.post).mockRejectedValue(timeoutError);

    await expect(dispatch('https://hooks.example.com', mockPayload)).resolves.toBeUndefined();
  });
});
