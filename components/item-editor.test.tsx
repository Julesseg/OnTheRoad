import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ItemEditor } from '@/components/item-editor';

vi.mock('@react-native-community/datetimepicker', () => ({ default: () => null }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ItemEditor', () => {
  it('renders fields appropriate to a location', () => {
    render(<ItemEditor type="location" itemId="x" onSubmit={() => {}} />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Coordinates')).toBeInTheDocument();
  });

  it('renders only a text field for a note', () => {
    render(<ItemEditor type="note" itemId="x" onSubmit={() => {}} />);
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Note')).toBeInTheDocument();
  });

  it('shows a required error and does not submit when name is empty', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor type="location" itemId="x" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a built item when valid', async () => {
    const onSubmit = vi.fn();
    render(<ItemEditor type="location" itemId="loc-1" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pier' } });
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: '1 Quay' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ type: 'location', id: 'loc-1', name: 'Pier', address: '1 Quay' }),
    );
  });

  it('invokes onDelete when editing an existing item', () => {
    const onDelete = vi.fn();
    render(
      <ItemEditor
        type="note"
        itemId="n1"
        initialItem={{ type: 'note', id: 'n1', text: 'hi' }}
        onSubmit={() => {}}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('omits the Delete control when creating a new item', () => {
    render(<ItemEditor type="note" itemId="n2" onSubmit={() => {}} onDelete={() => {}} />);
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });
});
