import { afterEach, describe, expect, it } from 'vitest';
import { reportFontLinkTag, syncReportFont } from '../../utils/reportFont';

const links = () => document.head.querySelectorAll('#report-font-cn');

describe('syncReportFont', () => {
  afterEach(() => links().forEach(link => link.remove()));

  it('loads the Chinese glyphs once, for Chinese and English', () => {
    syncReportFont('zh');
    syncReportFont('en');
    expect(links()).toHaveLength(1);
    expect(links()[0].getAttribute('href')).toContain('fonts/typewriter-cn/font.css');
  });

  it('leaves them out for Japanese, also after switching', () => {
    syncReportFont('ja');
    expect(links()).toHaveLength(0);
    syncReportFont('zh');
    syncReportFont('ja');
    expect(links()).toHaveLength(0);
  });

  it('gives a print window an absolute link only while the font is on', () => {
    expect(reportFontLinkTag()).toBe('');
    syncReportFont('zh');
    expect(reportFontLinkTag()).toMatch(/<link href="https?:.*fonts\/typewriter-cn\/font\.css" rel="stylesheet">/);
  });
});
