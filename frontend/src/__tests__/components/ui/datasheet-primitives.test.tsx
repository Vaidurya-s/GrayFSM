import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  Kicktitle,
  TypedSection,
  MarginalNote,
  DataBlock,
  RuledTable,
  SpecField,
  PullFigure,
  CommandKey,
  CommandKeyRow,
} from '../../../components/ui';

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Kicktitle', () => {
  it('renders the section number, sigil, and label', () => {
    render(<Kicktitle number="0.1">Held in catalog</Kicktitle>);
    expect(screen.getByText(/Held in catalog/)).toBeInTheDocument();
    expect(screen.getByText('0.1')).toBeInTheDocument();
    expect(screen.getByText('§')).toBeInTheDocument();
  });

  it('respects a custom sigil', () => {
    render(<Kicktitle sigil="¶" number="II">Note</Kicktitle>);
    expect(screen.getByText('¶')).toBeInTheDocument();
    expect(screen.queryByText('§')).not.toBeInTheDocument();
  });

  it('omits the number span when number is not given', () => {
    render(<Kicktitle>Naked</Kicktitle>);
    expect(screen.getByText('Naked')).toBeInTheDocument();
  });
});

describe('TypedSection', () => {
  it('renders title, number, meta and children', () => {
    render(
      <TypedSection number="0.1" title="Held in catalog" meta="N = 7">
        <div data-testid="body">body</div>
      </TypedSection>,
    );
    expect(screen.getByText('Held in catalog')).toBeInTheDocument();
    expect(screen.getByText('0.1')).toBeInTheDocument();
    expect(screen.getByText('N = 7')).toBeInTheDocument();
    expect(screen.getByTestId('body')).toBeInTheDocument();
  });

  it('produces an h2 by default and h3/h4 when level overridden', () => {
    const { rerender } = render(
      <TypedSection title="A">
        <span />
      </TypedSection>,
    );
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();

    rerender(
      <TypedSection title="A" level={3}>
        <span />
      </TypedSection>,
    );
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();

    rerender(
      <TypedSection title="A" level={4}>
        <span />
      </TypedSection>,
    );
    expect(screen.getByRole('heading', { level: 4 })).toBeInTheDocument();
  });
});

describe('MarginalNote', () => {
  it('renders heading and children inside an aside', () => {
    render(
      <MarginalNote heading="System">
        <span data-testid="content">x</span>
      </MarginalNote>,
    );
    expect(screen.getByRole('complementary')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('renders without a heading when omitted', () => {
    render(<MarginalNote>x</MarginalNote>);
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });
});

describe('DataBlock', () => {
  it('renders label / value pairs', () => {
    render(
      <DataBlock
        items={[
          { label: 'API', value: 'online', tone: 'ok' },
          { label: 'Latency', value: '34 ms' },
          { label: 'Build', value: '38f2a49', tone: 'accent' },
        ]}
      />,
    );
    expect(screen.getByText('API')).toBeInTheDocument();
    expect(screen.getByText('online')).toBeInTheDocument();
    expect(screen.getByText('34 ms')).toBeInTheDocument();
    expect(screen.getByText('38f2a49')).toBeInTheDocument();
  });

  it('produces a <dl> with one <dt>/<dd> per item', () => {
    const { container } = render(
      <DataBlock items={[{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }]} />,
    );
    expect(container.querySelectorAll('dt').length).toBe(2);
    expect(container.querySelectorAll('dd').length).toBe(2);
  });
});

describe('RuledTable', () => {
  type Row = { id: string; name: string; n: number };
  const rows: Row[] = [
    { id: 'a', name: 'Traffic light', n: 7 },
    { id: 'b', name: 'Vending', n: 9 },
  ];

  it('renders headers and one row per data item', () => {
    render(
      <RuledTable<Row>
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          { header: 'Name', mono: false, cell: (r) => r.name },
          { header: 'States', tabular: true, align: 'right', cell: (r) => r.n },
        ]}
      />,
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('States')).toBeInTheDocument();
    expect(screen.getByText('Traffic light')).toBeInTheDocument();
    expect(screen.getByText('Vending')).toBeInTheDocument();
  });

  it('fires onRowClick when a clickable row is activated', () => {
    const onRowClick = vi.fn();
    render(
      <RuledTable<Row>
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
        columns={[{ header: 'Name', cell: (r) => r.name }]}
      />,
    );
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onRowClick).toHaveBeenCalledWith(rows[0], 0);
  });

  it('also activates a clickable row on Enter / Space', () => {
    const onRowClick = vi.fn();
    render(
      <RuledTable<Row>
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
        columns={[{ header: 'Name', cell: (r) => r.name }]}
      />,
    );
    const button = screen.getAllByRole('button')[1];
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onRowClick).toHaveBeenLastCalledWith(rows[1], 1);
    fireEvent.keyDown(button, { key: ' ' });
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it('renders the empty fallback when rows is empty', () => {
    render(
      <RuledTable<Row>
        rows={[]}
        rowKey={(r) => r.id}
        columns={[{ header: 'Name', cell: (r) => r.name }]}
        empty={<div data-testid="empty">no FSMs</div>}
      />,
    );
    expect(screen.getByTestId('empty')).toBeInTheDocument();
  });

  it('marks rows aria-pressed when isSelected returns true', () => {
    render(
      <RuledTable<Row>
        rows={rows}
        rowKey={(r) => r.id}
        isSelected={(r) => r.id === 'b'}
        onRowClick={() => {}}
        columns={[{ header: 'Name', cell: (r) => r.name }]}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('SpecField', () => {
  it('renders label, value, and qualifier', () => {
    render(
      <SpecField
        label="Avg Hamming"
        value="1.00"
        qual="every transition flips one bit"
      />,
    );
    expect(screen.getByText('Avg Hamming')).toBeInTheDocument();
    expect(screen.getByText('1.00')).toBeInTheDocument();
    expect(screen.getByText('every transition flips one bit')).toBeInTheDocument();
  });
});

describe('PullFigure', () => {
  it('renders the figure, unit, caption, and source', () => {
    render(
      <PullFigure
        figure="73%"
        unit="reduction in adjacent-state Hamming distance"
        caption="across the seven specifications presently held"
        source="catalog summary"
      />,
    );
    expect(screen.getByText('73%')).toBeInTheDocument();
    expect(screen.getByText(/reduction in adjacent-state/)).toBeInTheDocument();
    expect(screen.getByText(/across the seven/)).toBeInTheDocument();
    expect(screen.getByText(/— catalog summary/)).toBeInTheDocument();
  });
});

describe('CommandKey', () => {
  it('renders as a button by default and fires onClick', () => {
    const onClick = vi.fn();
    renderWithRouter(
      <CommandKey keyGlyph="∅" onClick={onClick}>
        From example
      </CommandKey>,
    );
    const btn = screen.getByRole('button', { name: /from example/i });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByText('∅')).toBeInTheDocument();
  });

  it('renders as a Link when `to` is provided', () => {
    renderWithRouter(
      <CommandKey to="/editor/new" keyGlyph="↳">
        New FSM
      </CommandKey>,
    );
    const a = screen.getByRole('link', { name: /new fsm/i });
    expect(a).toHaveAttribute('href', '/editor/new');
  });

  it('groups multiple keys cleanly inside CommandKeyRow', () => {
    renderWithRouter(
      <CommandKeyRow>
        <CommandKey primary keyGlyph="↳" to="/x">
          A
        </CommandKey>
        <CommandKey keyGlyph="⌃" to="/y">
          B
        </CommandKey>
      </CommandKeyRow>,
    );
    expect(screen.getAllByRole('link').length).toBe(2);
  });
});
