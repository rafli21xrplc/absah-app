'use client';

import { useState, type ComponentPropsWithRef } from 'react';
import { messages } from '../../../messages/id';
import { Field, Input } from '../../components/field';

export interface PasswordFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'className'> {
  label: string;
  hint?: string;
  error?: string;
}

/**
 * A password box with a Tampilkan / Sembunyikan button (aria-pressed). Pasting is never blocked. The button name is spoken in full
 * ("Tampilkan kata sandi") while only the short word is seen.
 */
export function PasswordField({ label, hint, error, ...input }: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  const t = messages.auth;
  return (
    <Field label={label} hint={hint} error={error}>
      <span className="relative flex">
        <Input {...input} type={shown ? 'text' : 'password'} className="pr-32" />
        <button
          type="button"
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
          className="absolute right-1 top-0.5 min-h-11 cursor-pointer rounded-md border-0 bg-transparent px-3 text-body-strong font-bold text-papan hover:bg-papan-soft"
        >
          {shown ? t.hide : t.show}{' '}
          <span className="sr-only">{t.passwordNoun}</span>
        </button>
      </span>
    </Field>
  );
}
