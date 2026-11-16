import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CapabilitiesProvider, IfCap, toCapabilityValues, useCapability } from './capabilities';

function Mode() {
  return <span>{useCapability('attendance.mode') ?? 'none'}</span>;
}

const render = (caps: Record<string, unknown> | null, node: React.ReactNode) =>
  renderToStaticMarkup(<CapabilitiesProvider capabilities={caps}>{node}</CapabilitiesProvider>);

describe('capabilities in the web', () => {
  it('shows children only when the capability is on', () => {
    const menu = (
      <>
        <IfCap name="gate.pickup">Penjemputan</IfCap>
        <IfCap name="pkl.enabled" fallback="-">PKL</IfCap>
      </>
    );
    expect(render({ 'gate.pickup': true, 'pkl.enabled': false }, menu)).toBe('Penjemputan-');
    expect(render(null, menu)).toBe('-');
  });

  it('reads enum capabilities', () => {
    expect(render({ 'attendance.mode': 'daily' }, <Mode />)).toBe('<span>daily</span>');
    expect(renderToStaticMarkup(<Mode />)).toBe('<span>none</span>'); // no provider: off
  });

  it('drops keys and values this build does not know', () => {
    expect(
      toCapabilityValues({ 'gate.pickup': true, 'future.feature': true, 'attendance.mode': 'weekly', 'pkl.enabled': 'yes' }),
    ).toEqual({ 'gate.pickup': true });
  });
});
