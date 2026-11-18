import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { INCOMING_MESSAGES } from '@/lib/incoming';
import { IncomingMessage } from './IncomingMessage';

describe('IncomingMessage', () => {
  it('[Req 12.2] shows the chosen line as text', () => {
    render(<IncomingMessage messageIndex={3} />);
    expect(screen.getByText(INCOMING_MESSAGES[3] ?? '')).toBeInTheDocument();
  });
  it('[Req 9.1] is a labelled region that screen readers announce politely', () => {
    render(<IncomingMessage messageIndex={0} />);
    expect(screen.getByRole('log', { name: 'Message from the line' })).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });
  it('[Req 12.2] shows nothing for an index that is not on the list', () => {
    const { container } = render(<IncomingMessage messageIndex={999} />);
    expect(container).toBeEmptyDOMElement();
  });
});
