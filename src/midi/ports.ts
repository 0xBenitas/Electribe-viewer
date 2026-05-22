import type { PortInfo, PortPair } from './types.ts';

const ELECTRIBE_NAME = /electribe/i;

export function toPortInfo(port: MIDIPort): PortInfo {
  return {
    id: port.id,
    name: port.name ?? '(unnamed)',
    manufacturer: port.manufacturer ?? '',
  };
}

/**
 * Pair MIDI inputs with outputs by name.
 *
 * Phase 0 finding (99.2): the EMX2 exposes more than one USB endpoint sharing
 * the same name. We key by name and keep the first IN/OUT of each name, which
 * deduplicates the doubled message delivery.
 */
export function pairPorts(access: MIDIAccess): PortPair[] {
  const inputsByName = new Map<string, MIDIInput>();
  for (const input of access.inputs.values()) {
    const name = input.name ?? input.id;
    if (!inputsByName.has(name)) inputsByName.set(name, input);
  }

  const pairs: PortPair[] = [];
  const usedNames = new Set<string>();
  for (const output of access.outputs.values()) {
    const name = output.name ?? output.id;
    if (usedNames.has(name)) continue;
    const input = inputsByName.get(name);
    if (!input) continue;
    usedNames.add(name);
    pairs.push({ key: name, name, input, output });
  }
  return pairs;
}

export function findElectribePairs(pairs: PortPair[]): PortPair[] {
  return pairs.filter((p) => ELECTRIBE_NAME.test(p.name));
}
