'use client';

import {
  isCapabilityKey,
  parseCapabilityValue,
  type BoolCapability,
  type CapabilityKey,
  type CapabilityValues,
} from '@absah/capabilities';
import { createContext, useContext, type ReactNode } from 'react';

/**
 * Capabilities of the active school, as resolved by the API (GET /api/v1/me/context ->
 * active.capabilities). The web never resolves them itself and never branches on the level.
 */
const CapabilitiesContext = createContext<Partial<CapabilityValues>>({});

/**
 * Keeps only keys and values this build of the web knows. During a rollout the API may already
 * send a newer catalog; unknown keys are dropped and missing ones read as off.
 */
export function toCapabilityValues(map: Record<string, unknown> | null | undefined): Partial<CapabilityValues> {
  const out: Partial<Record<CapabilityKey, unknown>> = {};
  for (const [key, value] of Object.entries(map ?? {})) {
    if (isCapabilityKey(key) && parseCapabilityValue(key, value).ok) out[key] = value;
  }
  return out as Partial<CapabilityValues>;
}

export function CapabilitiesProvider({
  capabilities,
  children,
}: {
  capabilities: Record<string, unknown> | null | undefined;
  children: ReactNode;
}) {
  return <CapabilitiesContext value={toCapabilityValues(capabilities)}>{children}</CapabilitiesContext>;
}

/** Value of one capability in the active school; undefined without a school (treat as off). */
export function useCapability<K extends CapabilityKey>(key: K): CapabilityValues[K] | undefined {
  return useContext(CapabilitiesContext)[key];
}

/** All capabilities of the active school at once, for code that decides many things (the menu). */
export function useCapabilities(): Partial<CapabilityValues> {
  return useContext(CapabilitiesContext);
}

/**
 * Renders children only when a boolean capability is on, e.g. menu entries:
 *   <IfCap name="gate.pickup"><NavLink href="/penjemputan">Penjemputan</NavLink></IfCap>
 * Hiding is cosmetic: the API still guards the route with requireCap.
 */
export function IfCap({ name, children, fallback = null }: { name: BoolCapability; children: ReactNode; fallback?: ReactNode }) {
  return useCapability(name) === true ? children : fallback;
}
