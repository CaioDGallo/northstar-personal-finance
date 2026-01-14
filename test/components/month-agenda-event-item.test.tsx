// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonthAgendaEventItem } from '@/components/calendar/month-agenda-event-item';
import type { CalendarEvent } from '@schedule-x/calendar';

const timeStub = {
  toLocaleString: () => '9:00 AM',
} as unknown as CalendarEvent['start'];

const baseEvent = {
  id: 'task-42',
  title: 'Test Task',
  start: timeStub,
  end: timeStub,
  calendarId: 'tasks',
  priority: 'medium',
  status: 'pending',
  itemType: 'task',
  itemId: 42,
} as const;

describe('MonthAgendaEventItem', () => {
  it('calls onEdit from context menu', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <MonthAgendaEventItem
        calendarEvent={baseEvent}
        onEdit={onEdit}
      />
    );

    const item = screen.getByLabelText(/Test Task/);
    fireEvent.contextMenu(item);

    const editItem = await screen.findByText('Edit task');
    await user.click(editItem);

    expect(onEdit).toHaveBeenCalledWith(42, 'task');
  });

  it('calls onDelete from context menu', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(
      <MonthAgendaEventItem
        calendarEvent={baseEvent}
        onDelete={onDelete}
      />
    );

    const item = screen.getByLabelText(/Test Task/);
    fireEvent.contextMenu(item);

    const deleteItem = await screen.findByText('Delete task');
    await user.click(deleteItem);

    expect(onDelete).toHaveBeenCalledWith(42, 'task');
  });

  it('shows cancelled tasks with line-through styling', () => {
    render(
      <MonthAgendaEventItem
        calendarEvent={{ ...baseEvent, title: 'Cancelled Task', status: 'cancelled' }}
      />
    );

    const title = screen.getByText('Cancelled Task');
    expect(title).toHaveClass('line-through');
  });
});
