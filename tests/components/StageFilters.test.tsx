import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { StageFilters } from '../../components/game/stage/StageOverlays';

describe('StageFilters', () => {
  it.each(['net-edge-glow', 'net-thread-glow'])('%s 的区域不依赖线条的包围盒，水平直线才不会消失', id => {
    const { container } = render(<StageFilters />);
    const filter = container.querySelector(`#${id}`) as Element;
    expect(filter.getAttribute('filterUnits')).toBe('userSpaceOnUse');
    expect(filter.getAttribute('width')).not.toContain('%');
    expect(filter.getAttribute('height')).not.toContain('%');
  });
});
