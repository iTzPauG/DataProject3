/**
 * Account display helpers.
 *
 * Single source of truth for "what name should we show this user?"
 * Used by the profile page, the floating avatar, greetings, etc.
 *
 * Rules:
 * - Business accounts → restaurant_name (the brand name) takes priority over display_name.
 * - Personal accounts → display_name, falling back to local-part of the email.
 * - Anonymous / no profile → null.
 */

interface MinimalProfile {
  display_name?: string | null;
  role?: 'user' | 'business' | 'admin' | string | null;
  restaurant_name?: string | null;
}

interface MinimalUser {
  email?: string | null;
  displayName?: string | null;
}

/**
 * Returns the canonical name for the active account.
 * For businesses, prioritizes the restaurant brand name. For users, uses display name or email handle.
 * Returns null if there's nothing usable.
 */
export function resolveAccountName(
  profile: MinimalProfile | null | undefined,
  user: MinimalUser | null | undefined,
): string | null {
  if (profile?.role === 'business') {
    const brand = profile?.restaurant_name?.trim();
    if (brand) return brand;
  }
  const display = profile?.display_name?.trim();
  if (display) return display;
  const handleFromEmail = user?.email?.split('@')[0]?.trim();
  if (handleFromEmail) return handleFromEmail;
  if (user?.displayName?.trim()) return user.displayName.trim();
  return null;
}

/**
 * Short form of {@link resolveAccountName} — first whitespace-delimited token.
 * Used for greetings like "Hola, Pepica".
 * Businesses still get their full brand name (we don't truncate brands, since
 * "La Pepica" → "La" looks like a bug).
 */
export function resolveGreetingName(
  profile: MinimalProfile | null | undefined,
  user: MinimalUser | null | undefined,
): string | null {
  const full = resolveAccountName(profile, user);
  if (!full) return null;
  if (profile?.role === 'business') return full;
  return full.split(/\s+/)[0] || full;
}

/** Compact 1-2 letter initials suitable for an avatar fallback. */
export function getInitials(
  profile: MinimalProfile | null | undefined,
  user: MinimalUser | null | undefined,
): string {
  const name = resolveAccountName(profile, user);
  if (!name) return '?';
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    return (tokens[0][0] + tokens[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
