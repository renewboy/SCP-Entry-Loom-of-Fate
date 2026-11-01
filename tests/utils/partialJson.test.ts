import { describe, expect, it } from 'vitest';
import { parsePartialJson } from '../../utils/partialJson';

describe('parsePartialJson', () => {
  it('读完整的 JSON', () => {
    expect(parsePartialJson('{"a":1,"b":[true,null]}')).toEqual({ a: 1, b: [true, null] });
  });

  it('还没写出内容时返回 null', () => {
    expect(parsePartialJson('')).toBeNull();
  });

  it('保留写到一半的字符串', () => {
    expect(parsePartialJson('{"name":"虚影之')).toEqual({ name: '虚影之' });
  });

  it('补上没关的数组和对象', () => {
    expect(parsePartialJson('{"nodes":[{"id":"a","danger":15},{"id":"b"')).toEqual({ nodes: [{ id: 'a', danger: 15 }, { id: 'b' }] });
  });

  it('丢掉还没有值的键', () => {
    expect(parsePartialJson('{"a":1,"b"')).toEqual({ a: 1 });
    expect(parsePartialJson('{"a":1,"b":')).toEqual({ a: 1 });
  });

  it('写到一半的数字先不算', () => {
    expect(parsePartialJson('{"a":"x","danger":4')).toEqual({ a: 'x' });
  });

  it('字符串在转义符处断开时退回上一个完整的值', () => {
    expect(parsePartialJson('{"a":"x","b":"y\\')).toEqual({ a: 'x' });
  });
});
