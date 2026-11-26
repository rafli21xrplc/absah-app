'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useRef, useState, type SelectHTMLAttributes } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command';
import { borderClass, controlClass, useControl } from './field';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import type { Section } from './select-sections';

/** A search box only helps when the list is long; shorter lists keep the box for typing a letter but do not show it. */
const SEARCH_FROM = 8;

export default function PopoverSelect({ sections, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { sections: Section[] }) {
  const c = useControl(props);
  const native = useRef<HTMLSelectElement>(null);
  const [open, setOpen] = useState(false);
  const [own, setOwn] = useState(String(props.defaultValue ?? ''));
  const all = sections.flatMap((s) => s.choices);
  // Like the browser: a value that matches no option shows the first one.
  const value = props.value !== undefined ? String(props.value) : own;
  const current = all.find((choice) => choice.value === value) ?? all.find((choice) => !choice.disabled) ?? all[0];
  const long = all.length >= SEARCH_FROM;
  // The real <select> is only the form control behind the button: it takes no id and no accessible name of its own.
  const { value: _value, defaultValue: _default, onChange, id: _id, 'aria-label': _label, 'aria-labelledby': _labelledby, 'aria-describedby': _described, 'aria-invalid': _invalid, ...rest } = props;

  function choose(next: string) {
    setOpen(false);
    setOwn(next);
    const select = native.current;
    if (!select || select.value === next) return;
    // Set the value the way a user's pick would, then fire the real change event: onChange gets a genuine event whose target is a <select>.
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, next);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  return (
    <span className="relative block">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            id={c.id}
            aria-label={props['aria-label']}
            aria-describedby={c['aria-describedby']}
            aria-invalid={c['aria-invalid']}
            disabled={props.disabled}
            className={cx(controlClass, 'flex min-h-12 cursor-pointer items-center justify-between gap-2 pr-3 text-left', borderClass(c.invalid), className)}
          >
            <span className="truncate">{current?.label ?? ''}</span>
            <ChevronDown aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-tinta-muted" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" {...(c.labelId ? { 'aria-labelledby': c.labelId } : { 'aria-label': props['aria-label'] ?? messages.select.choices })} className="w-(--radix-popover-trigger-width) min-w-56 p-0">
          <Command
            defaultValue={current ? String(all.indexOf(current)) : undefined}
            filter={(item, search, keywords) => ((keywords?.[0] ?? item).toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0)}
          >
            <div className={long ? undefined : 'sr-only'}>
              <CommandInput aria-label={props['aria-label'] ?? messages.select.search} placeholder={messages.select.search} />
            </div>
            <CommandList>
              <CommandEmpty>{messages.select.empty}</CommandEmpty>
              {sections.map((section, s) => (
                <CommandGroup key={section.heading ?? `loose-${s}`} {...(section.heading !== null ? { heading: section.heading } : {})}>
                  {section.choices.map((choice) => (
                    <CommandItem
                      key={choice.value}
                      value={String(all.indexOf(choice))}
                      keywords={[choice.label]}
                      disabled={choice.disabled}
                      aria-checked={choice === current}
                      onSelect={() => choose(choice.value)}
                    >
                      <span className="flex-1">{choice.label}</span>
                      {choice === current && <Check aria-hidden strokeWidth={2} className="size-4 text-papan" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {/* After the button: a <label> wrapped around the whole control names its first labelable child, which must be the button. */}
      <select
        {...rest}
        ref={native}
        {...(props.value !== undefined ? { value: props.value } : { defaultValue: props.defaultValue })}
        onChange={onChange}
        aria-hidden
        tabIndex={-1}
        className="sr-only"
      >
        {children}
      </select>
    </span>
  );
}
