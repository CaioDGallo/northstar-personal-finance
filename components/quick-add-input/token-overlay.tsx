import { InputToken } from './input-token';
import type { TokenMatch } from './types';

interface TokenOverlayProps {
  value: string;
  tokens: TokenMatch[];
  className?: string;
}

/**
 * Overlay that renders tokens as badges over the hidden input
 * Matches input styling exactly for perfect alignment
 */
export function TokenOverlay({ value, tokens, className }: TokenOverlayProps) {
  // Build segments: mix of tokens and plain text
  const segments: Array<{ type: 'token' | 'text'; content: string; token?: TokenMatch }> = [];

  if (tokens.length === 0) {
    // No tokens, render as plain text
    segments.push({ type: 'text', content: value });
  } else {
    let lastEnd = 0;

    tokens.forEach(token => {
      // Add plain text before this token
      if (token.start > lastEnd) {
        segments.push({
          type: 'text',
          content: value.slice(lastEnd, token.start),
        });
      }

      // Add token
      segments.push({
        type: 'token',
        content: token.text,
        token,
      });

      lastEnd = token.end;
    });

    // Add remaining plain text after last token
    if (lastEnd < value.length) {
      segments.push({
        type: 'text',
        content: value.slice(lastEnd),
      });
    }
  }

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        whiteSpace: 'pre-wrap',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      <div className="flex flex-wrap items-center gap-0.5">
        {segments.map((segment, index) => {
          if (segment.type === 'token' && segment.token) {
            return <InputToken key={`token-${index}`} token={segment.token} />;
          }
          return (
            <span key={`text-${index}`} className="whitespace-pre">
              {segment.content}
            </span>
          );
        })}
      </div>
    </div>
  );
}
