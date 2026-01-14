// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventDetailSheet } from '@/components/calendar/event-detail-sheet';

describe('EventDetailSheet', () => {
  it('renders task duration details when provided', () => {
    render(
      <EventDetailSheet
        open
        onOpenChange={() => {}}
        event={{
          id: 1,
          title: 'Write tests',
          description: 'Detail sheet for task',
          location: 'Desk',
          startAt: new Date('2026-02-01T09:00:00Z'),
          endAt: new Date('2026-02-01T10:30:00Z'),
          priority: 'medium',
          status: 'pending',
          type: 'task',
          durationMinutes: 90,
        }}
      />
    );

    expect(screen.getByText('Write tests')).toBeInTheDocument();
    expect(screen.getByText('Duration:')).toBeInTheDocument();
    expect(screen.getAllByText('1h 30m').length).toBeGreaterThan(0);
  });

  it('renders occurrence start/end using the provided timezone', () => {
    const timeZone = 'UTC';
    const startAt = new Date('2026-04-15T13:00:00Z');
    const endAt = new Date('2026-04-15T14:15:00Z');

    const expectedStart = startAt.toLocaleString(undefined, {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const expectedEnd = endAt.toLocaleString(undefined, {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    render(
      <EventDetailSheet
        open
        timeZone={timeZone}
        onOpenChange={() => {}}
        event={{
          id: 42,
          title: 'Occurrence Task',
          description: null,
          location: null,
          startAt,
          endAt,
          priority: 'high',
          status: 'pending',
          type: 'task',
          durationMinutes: 75,
        }}
      />
    );

    expect(screen.getByText(expectedStart)).toBeInTheDocument();
    expect(screen.getByText(`to ${expectedEnd}`)).toBeInTheDocument();
  });
});
