import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';

export interface Choice {
  value: string;
  label: string;
  disabled: boolean;
}
export interface Section {
  heading: string | null;
  choices: Choice[];
}

function textOf(node: ReactNode): string | null {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) {
    const parts = node.map(textOf);
    return parts.every((p) => p !== null) ? parts.join('') : null;
  }
  return node === null || node === undefined || typeof node === 'boolean' ? '' : null;
}

/** Reads <option> and <optgroup> children. Anything else (a component that renders options) cannot be read: null = use the native select. */
export function readSections(children: ReactNode): Section[] | null {
  const sections: Section[] = [];
  let loose: Section | null = null;
  const add = (heading: string | null, nodes: ReactNode): boolean => {
    for (const node of Children.toArray(nodes)) {
      if (!isValidElement(node)) return false;
      const el = node as ReactElement<{ value?: string | number; disabled?: boolean; label?: string; children?: ReactNode }>;
      if (el.type === Fragment) {
        if (!add(heading, el.props.children)) return false;
      } else if (el.type === 'option') {
        const label = textOf(el.props.children);
        if (label === null) return false;
        const choice: Choice = { value: String(el.props.value ?? label), label, disabled: Boolean(el.props.disabled) };
        if (heading === null) {
          if (!loose) sections.push((loose = { heading: null, choices: [] }));
          loose.choices.push(choice);
        } else {
          const last = sections[sections.length - 1];
          if (last?.heading === heading) last.choices.push(choice);
          else sections.push({ heading, choices: [choice] });
        }
      } else if (el.type === 'optgroup') {
        loose = null;
        if (el.props.label === undefined || !add(el.props.label, el.props.children)) return false;
      } else {
        return false;
      }
    }
    return true;
  };
  return add(null, children) ? sections : null;
}

