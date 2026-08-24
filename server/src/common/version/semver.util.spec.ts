import { compareVersions, isBelowMinimum, parseVersion } from './semver.util';

describe('semver.util', () => {
  it('parses the numeric core and drops prerelease / build metadata', () => {
    expect(parseVersion('1.2.10')).toEqual([1, 2, 10]);
    expect(parseVersion(' 1.3.0-beta.2 ')).toEqual([1, 3, 0]);
    expect(parseVersion('2.0.0+42')).toEqual([2, 0, 0]);
    expect(parseVersion('1.2')).toEqual([1, 2]);
  });

  it('refuses anything that is not a plain numeric version', () => {
    for (const bad of ['', 'v1.2.0', 'latest', '1.x.0', null, undefined, '1..2']) {
      expect(parseVersion(bad as string)).toBeNull();
    }
  });

  it('compares numerically, not lexicographically', () => {
    // Le piège classique : "1.10.0" < "1.9.0" en comparaison de chaînes.
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0);
    expect(compareVersions('1.2.0', '1.2.1')).toBe(-1);
  });

  it('treats missing components as zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.2', '1.2.1')).toBe(-1);
  });

  it('returns null when either side is unreadable', () => {
    expect(compareVersions('abc', '1.0.0')).toBeNull();
    expect(compareVersions('1.0.0', undefined)).toBeNull();
  });

  it('never blocks when the comparison is uncertain', () => {
    expect(isBelowMinimum('1.2.0', '1.3.0')).toBe(true);
    expect(isBelowMinimum('1.3.0', '1.3.0')).toBe(false);
    expect(isBelowMinimum('1.4.0', '1.3.0')).toBe(false);
    expect(isBelowMinimum(undefined, '1.3.0')).toBe(false);
    expect(isBelowMinimum('1.2.0', null)).toBe(false);
    expect(isBelowMinimum('garbage', '1.3.0')).toBe(false);
  });
});
