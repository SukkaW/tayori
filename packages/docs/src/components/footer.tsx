import * as stylex from '@stylexjs/stylex';
import { CurrentYear } from 'foxact/current-year';

const styles = stylex.create({
  root: {
    backgroundColor: '#f7f4ef',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: '#e5e0d8',
    paddingBlock: '24px',
    paddingInline: 'clamp(24px,5vw,72px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 10,
    columnGap: 10
  },
  text: {
    fontSize: 12.5,
    color: '#786e63'
  },
  textLink: {
    color: '#0e7490',
    textDecoration: 'none'
  },
  links: {
    display: 'flex',
    rowGap: 16,
    columnGap: 16
  },
  link: {
    fontSize: 12.5,
    color: {
      default: '#786e63',
      ':hover': '#1c1915'
    },
    textDecoration: 'none'
  }
});

export function Footer() {
  return (
    <footer {...stylex.props(styles.root)}>
      <p {...stylex.props(styles.text)}>
        tayori
        {' '}
        &copy;
        {' '}
        <CurrentYear defaultYear={2026} />
        {' '}
        {/* eslint-disable-next-line @eslint-react/dom-no-unsafe-target-blank -- my own website */}
        <a href="https://skk.moe" target="_blank" {...stylex.props(styles.textLink)}>
          Sukka
        </a>
        {' '}
        ·
        {' '}
        MIT
      </p>
      <div {...stylex.props(styles.links)}>
        <a href="https://github.com/SukkaW/tayori" target="_blank" rel="noopener noreferrer" {...stylex.props(styles.link)}>GitHub</a>
        <a href="https://github.com/SukkaW/tayori/issues" target="_blank" rel="noopener noreferrer" {...stylex.props(styles.link)}>Issues</a>
        <a href="https://github.com/SukkaW/tayori/blob/master/LICENSE" target="_blank" rel="noopener noreferrer" {...stylex.props(styles.link)}>License</a>
      </div>
    </footer>
  );
}
