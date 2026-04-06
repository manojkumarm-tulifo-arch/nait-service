import { useState, useEffect, useMemo } from 'react';
import * as api from '../api/verification';
import type { SlotInfo } from '../api/verification';

interface ScheduleStepProps {
  token: string;
  candidateName: string;
  onComplete: () => void;
}

export default function ScheduleStep({ token, candidateName, onComplete }: ScheduleStepProps) {
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getAvailableSlots(token);
        setSlots(data.availableSlots);
      } catch {
        setError('Failed to load available slots');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // Group slots by date
  const slotsByDate = useMemo(() => {
    const map = new Map<string, SlotInfo[]>();
    for (const slot of slots) {
      const dateKey = new Date(slot.start).toISOString().slice(0, 10);
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(slot);
    }
    return map;
  }, [slots]);

  const dates = useMemo(() => [...slotsByDate.keys()].sort(), [slotsByDate]);

  useEffect(() => {
    if (dates.length > 0 && !selectedDate) setSelectedDate(dates[0]);
  }, [dates, selectedDate]);

  const currentDateSlots = selectedDate ? (slotsByDate.get(selectedDate) ?? []) : [];

  const formatDateLabel = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const date = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    return { day, date, month };
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const handleBook = async () => {
    if (!selectedSlot) return;
    setBooking(true);
    setError(null);
    try {
      await api.bookSlot(token, selectedSlot);
      onComplete();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to book slot');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center py-12">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500">Loading available slots...</p>
      </div>
    );
  }

  const firstName = candidateName.split(' ')[0];

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{firstName}, pick your slot</h2>
      <p className="text-gray-500 mb-8">Choose a date and time for your interview.</p>

      {/* Date selector */}
      <div className="w-full max-w-lg mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Date</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dates.map((d) => {
            const label = formatDateLabel(d);
            const isSelected = d === selectedDate;
            const openCount = slotsByDate.get(d)?.filter((s) => s.available).length ?? 0;
            return (
              <button
                key={d}
                onClick={() => { setSelectedDate(d); setSelectedSlot(null); }}
                className={`flex-shrink-0 w-20 py-3 rounded-xl border-2 text-center transition-all ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-gray-200 hover:border-indigo-300'
                }`}
              >
                <p className={`text-xs font-medium ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`}>{label.day}</p>
                <p className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-gray-800'}`}>{label.date}</p>
                <p className={`text-xs ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`}>{label.month}</p>
                {!isSelected && <p className="text-[10px] text-indigo-500 mt-0.5">{openCount} open</p>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time grid */}
      <div className="w-full max-w-lg mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Time</span>
          <span className="text-xs text-indigo-500">{currentDateSlots.filter((s) => s.available).length} open</span>
        </div>
        {currentDateSlots.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No available slots for this date.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {currentDateSlots.map((slot) => {
              const isSelected = selectedSlot === slot.start;
              const isBooked = !slot.available;
              return (
                <button
                  key={slot.start}
                  onClick={() => !isBooked && setSelectedSlot(slot.start)}
                  disabled={isBooked}
                  className={`py-2.5 px-2 rounded-lg text-sm font-medium border-2 transition-all ${
                    isBooked
                      ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed line-through'
                      : isSelected
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                  }`}
                >
                  {formatTime(slot.start)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <button
        onClick={handleBook}
        disabled={!selectedSlot || booking}
        className="w-full max-w-lg py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {booking ? (
          <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>Confirm Slot</>
        )}
      </button>
    </div>
  );
}
