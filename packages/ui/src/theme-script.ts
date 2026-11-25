// No React and no 'use client' here: the root layout (a server component) inlines this into <head>.
// theme.ts holds the hooks and is client-only, so the string and the key live apart from it.
/** Where the choice is kept in this browser. */
export const THEME_KEY = 'absah-tema';

/**
 * Runs in <head> before the first paint, so a saved "dark" never flashes light. Plain ES5 on purpose: it is inlined as a
 * string and must not depend on the bundle. Keep it in step with readTheme/applyTheme above (theme.test.ts runs both).
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;
