import { sanitizeLayout } from './orders.service';

/**
 * The implantation is the only part of an order line the server copies from the
 * client instead of recomputing, so everything it can be sent has to bounce off
 * a cap. None of it reaches the price — these tests guard what reaches storage
 * and the back office.
 */
describe('sanitizeLayout', () => {
  const valid = () => ({
    shape: 'l',
    room: { widthM: 3.8, depthM: 2.8, heightM: 2.5 },
    runs: [
      {
        wall: 'back',
        lengthM: 3.8,
        modules: [
          {
            moduleId: 'bas-simple-60',
            label: 'Caisson simple 60',
            slot: 'bas',
            offsetM: 0,
            widthMm: 600,
            depthMm: 600,
            priceCents: 18000,
          },
        ],
      },
    ],
    ilot: { widthM: 1.8, depthM: 0.9, topM: 1.1, rotationQuarters: 1, tight: true },
    worktopTopM: 0.95,
    credence: false,
    modulesTotalCents: 18000,
  });

  it('keeps a well-formed layout', () => {
    const out = sanitizeLayout(valid());
    expect(out).not.toBeNull();
    expect(out!.runs[0].modules).toHaveLength(1);
    expect(out!.modulesTotalCents).toBe(18000);
    expect(out!.ilot).toEqual({ widthM: 1.8, depthM: 0.9, topM: 1.1, rotationQuarters: 1, tight: true });
    expect(out!.credence).toBe(false);
  });

  it.each([null, undefined, 42, 'nope', {}, { room: {} }])(
    'rejects %p',
    (input) => {
      expect(sanitizeLayout(input)).toBeNull();
    },
  );

  it('rejects a layout with no runs', () => {
    expect(sanitizeLayout({ ...valid(), runs: [] })).toBeNull();
  });

  it('rejects non-finite and out-of-range room dimensions', () => {
    for (const bad of [Number.NaN, Infinity, -1, 1e9]) {
      const l = valid();
      l.room.widthM = bad;
      expect(sanitizeLayout(l)).toBeNull();
    }
  });

  it('caps runs and modules so one line cannot balloon the jsonb', () => {
    const l = valid();
    l.runs = Array.from({ length: 40 }, () => ({
      wall: 'back',
      lengthM: 3,
      modules: Array.from({ length: 500 }, () => ({
        moduleId: 'bas-simple-60',
        label: 'x',
        slot: 'bas',
        offsetM: 0,
        widthMm: 600,
        depthMm: 600,
        priceCents: 1,
      })),
    }));
    const out = sanitizeLayout(l)!;
    expect(out.runs).toHaveLength(4);
    expect(out.runs[0].modules).toHaveLength(60);
  });

  it('truncates long strings', () => {
    const l = valid();
    l.runs[0].modules[0].label = 'a'.repeat(5000);
    l.runs[0].modules[0].moduleId = 'b'.repeat(5000);
    const out = sanitizeLayout(l)!;
    expect(out.runs[0].modules[0].label).toHaveLength(80);
    expect(out.runs[0].modules[0].moduleId).toHaveLength(64);
  });

  it('clamps negative and absurd prices instead of trusting them', () => {
    const l = valid();
    l.runs[0].modules[0].priceCents = -5000;
    l.modulesTotalCents = 9e18;
    const out = sanitizeLayout(l)!;
    expect(out.runs[0].modules[0].priceCents).toBe(0);
    expect(out.modulesTotalCents).toBe(100_000_000);
  });

  it('drops modules with no id rather than storing blanks', () => {
    const l = valid();
    l.runs[0].modules.push({
      moduleId: '',
      label: 'ghost',
      slot: 'bas',
      offsetM: 1,
      widthMm: 600,
      depthMm: 600,
      priceCents: 1,
    });
    expect(sanitizeLayout(l)!.runs[0].modules).toHaveLength(1);
  });

  it('only accepts a quarter turn of 0-3', () => {
    for (const bad of [4, -1, 1.5, '1', null]) {
      const l = valid();
      (l as any).rotationQuarters = bad;
      (l.ilot as any).rotationQuarters = bad;
      expect(sanitizeLayout(l)!.rotationQuarters).toBe(0);
      expect(sanitizeLayout(l)!.ilot!.rotationQuarters).toBe(0);
    }
    expect(sanitizeLayout({ ...valid(), rotationQuarters: 3 })!.rotationQuarters).toBe(3);
  });

  it('keeps the crédence drawn unless the client declined it', () => {
    const l = valid();
    delete (l as any).credence;
    expect(sanitizeLayout(l)!.credence).toBe(true);
    expect(sanitizeLayout({ ...valid(), credence: false })!.credence).toBe(false);
  });

  it('only trusts a tight flag that is literally true', () => {
    const l = valid();
    (l.ilot as any).tight = 'yes';
    expect(sanitizeLayout(l)!.ilot!.tight).toBe(false);
  });

  it('keeps the worktop height the customer chose', () => {
    expect(sanitizeLayout(valid())!.worktopTopM).toBe(0.95);
  });

  it('falls back to a standard worktop height it cannot believe', () => {
    const l = valid();
    (l as any).worktopTopM = 'high';
    expect(sanitizeLayout(l)!.worktopTopM).toBe(0.9);
  });

  it('keeps module dimensions so the back office can draw the plan', () => {
    const out = sanitizeLayout(valid())!;
    expect(out.runs[0].modules[0].widthMm).toBe(600);
    expect(out.runs[0].modules[0].depthMm).toBe(600);
  });

  it('zeroes a dimension it cannot believe rather than drawing it', () => {
    const l = valid();
    (l.runs[0].modules[0] as any).widthMm = -1;
    (l.runs[0].modules[0] as any).depthMm = 'six hundred';
    const out = sanitizeLayout(l)!;
    expect(out.runs[0].modules[0].widthMm).toBe(0);
    expect(out.runs[0].modules[0].depthMm).toBe(0);
  });

  it('falls back to a base unit for an unknown slot', () => {
    const l = valid();
    (l.runs[0].modules[0] as any).slot = '<script>';
    expect(sanitizeLayout(l)!.runs[0].modules[0].slot).toBe('bas');
  });

  it('drops a partial island rather than storing half of one', () => {
    const l = valid();
    (l.ilot as any).depthM = 'wide';
    expect(sanitizeLayout(l)!.ilot).toBeUndefined();
  });

  /**
   * A run's position is measured from the middle of the kitchen, so half of
   * every legitimate coordinate is negative. The general number clamp rejects
   * anything below zero — routing these through it would have quietly zeroed
   * the arrangement the customer built and handed the workshop a kitchen with
   * every run stacked in one corner.
   */
  it('keeps a run standing to the left of the origin', () => {
    const l = valid();
    (l.runs[0] as any).x = -1.9;
    (l.runs[0] as any).z = -1.4;
    (l.runs[0] as any).rotationQuarters = 3;
    const out = sanitizeLayout(l)!;
    expect(out.runs[0].x).toBe(-1.9);
    expect(out.runs[0].z).toBe(-1.4);
    expect(out.runs[0].rotationQuarters).toBe(3);
  });

  it('caps a run flung far outside any real room', () => {
    const l = valid();
    (l.runs[0] as any).x = -1e9;
    (l.runs[0] as any).z = 'over there';
    const out = sanitizeLayout(l)!;
    expect(out.runs[0].x).toBe(0);
    expect(out.runs[0].z).toBe(0);
  });

  it('rejects a quarter turn that is not one of the four', () => {
    const l = valid();
    (l.runs[0] as any).rotationQuarters = 9;
    expect(sanitizeLayout(l)!.runs[0].rotationQuarters).toBe(0);
  });

  it('defaults a run with no position at all, for orders placed before moving', () => {
    const out = sanitizeLayout(valid())!;
    expect(out.runs[0].x).toBe(0);
    expect(out.runs[0].z).toBe(0);
    expect(out.runs[0].rotationQuarters).toBe(0);
  });

  it('carries the overlap flag through, and only when it is set', () => {
    const l = valid();
    expect((sanitizeLayout(l)! as any).runs[0].overlaps).toBeUndefined();
    (l.runs[0] as any).overlaps = true;
    expect((sanitizeLayout(l)! as any).runs[0].overlaps).toBe(true);
  });

  it('keeps a cabinet the customer stood free of its run', () => {
    const l = valid();
    Object.assign(l.runs[0].modules[0], { x: -1.2, z: 0.85, rotationQuarters: 2 });
    const m = sanitizeLayout(l)!.runs[0].modules[0] as any;
    expect(m.x).toBe(-1.2);
    expect(m.z).toBe(0.85);
    expect(m.rotationQuarters).toBe(2);
  });

  it('leaves a cabinet still in its row without a position of its own', () => {
    const m = sanitizeLayout(valid())!.runs[0].modules[0] as any;
    expect(m.x).toBeUndefined();
    expect(m.z).toBeUndefined();
    expect(m.rotationQuarters).toBeUndefined();
  });

  it('drops half a position rather than parking the cabinet at the origin', () => {
    const l = valid();
    // Losing one axis would otherwise default it to zero, which is the middle
    // of the room — a place the customer never put it.
    Object.assign(l.runs[0].modules[0], { x: -1.2, z: 'somewhere' });
    const m = sanitizeLayout(l)!.runs[0].modules[0] as any;
    expect(m.x).toBeUndefined();
    expect(m.z).toBeUndefined();
  });

  it('caps a free cabinet flung far outside any real room', () => {
    const l = valid();
    Object.assign(l.runs[0].modules[0], { x: 1e9, z: 0.4 });
    expect((sanitizeLayout(l)!.runs[0].modules[0] as any).x).toBeUndefined();
  });
});
