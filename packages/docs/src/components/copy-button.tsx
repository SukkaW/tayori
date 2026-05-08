'use client';

import { useClipboard } from 'foxact/use-clipboard';
import * as stylex from '@stylexjs/stylex';

const styles = stylex.create({
  button: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: {
      default: 'rgba(255, 255, 255, 0.06)',
      ':hover': 'rgba(255, 255, 255, 0.12)'
    },
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 5,
    paddingBlock: '4px',
    paddingInline: '9px',
    fontFamily: 'var(--font-jetbrains-mono), monospace',
    fontSize: 10.5,
    color: {
      default: 'rgba(255, 255, 255, 0.35)',
      ':hover': 'rgba(255, 255, 255, 0.7)'
    },
    cursor: 'pointer',
    opacity: 1,
    transitionProperty: 'background-color, color, border-color, opacity',
    transitionDuration: '0.15s'
  },
  buttonOk: {
    color: '#0e7490',
    borderColor: 'rgba(14, 116, 144, 0.4)',
    opacity: 1
  }
});

export function CopyButton({ code }: { code: string }) {
  const { copy, copied } = useClipboard({ timeout: 1400 });
  const handleCopy = () => {
    void copy(code);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      {...stylex.props(styles.button, copied && styles.buttonOk)}
    >
      {copied ? '✓ copied' : 'copy'}
    </button>
  );
}
