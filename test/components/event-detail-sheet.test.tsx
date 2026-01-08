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
});
