// Every number of the sign-in screens in ONE place (Auth-alur board: "angka waktu dan batas percobaan adalah usulan").
// The server decides; the screens only show. Change a value here, never inside a component.
export const AUTH = {
  /** A password-reset or invitation link lives this long (shown in the "Cek email" screen). */
  linkMinutes: 30,
  /** A WhatsApp or authenticator code is valid this long. */
  codeMinutes: 5,
  /** Wait before a code or link can be sent again. The server's own `retryAfter` wins when it sends one. */
  resendSeconds: 60,
  /** The account is locked for this long after `maxAttempts` wrong passwords (server rule; used only when it sends no time). */
  lockMinutes: 10,
  maxAttempts: 5,
  /** "Ingat saya" keeps the session this long (the server's session length wins). */
  rememberDays: 30,
  /** Quiet for this long, then "Masih di sini?" opens (UA4). */
  idleWarnMinutes: 28,
  /** How long "Masih di sini?" waits before signing out (UA4). */
  idleGraceSeconds: 120,
  /** After a sign-in the home page opens as soon as it is ready, and at the latest after this. */
  maxWaitAfterSignInMs: 4000,
  /**
   * Forgot-password needs absah-api to send email, which it cannot yet (no sender; Better Auth answers "Reset password isn't
   * enabled"). The link on the sign-in screen is shown only when the build sets NEXT_PUBLIC_ABSAH_PASSWORD_RESET=1.
   */
  passwordReset: process.env['NEXT_PUBLIC_ABSAH_PASSWORD_RESET'] === '1',
} as const;
