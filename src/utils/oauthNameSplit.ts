/**
 * Split a single display/full name from Apple or Google OAuth.
 * - First whitespace-separated word → first name
 * - Remaining words → last name (joined with spaces)
 * - One word only → last name is empty
 */
export function splitOAuthFullNameIntoFirstLast(fullName: string): { firstName: string; lastName: string } {
    const trimmed = fullName.trim();
    if (!trimmed || trimmed === '-') {
        return { firstName: '', lastName: '' };
    }
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
        return { firstName: '', lastName: '' };
    }
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' };
    }
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
