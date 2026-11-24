import { absahRules, ignores, noHexColors } from '@absah/config/eslint';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  { ignores },
  ...nextVitals,
  ...nextTs,
  { rules: absahRules },
  noHexColors,
];

export default config;
