/**
 * Data stored for a single contact entry.
 *
 * @property name - Display name for the contact
 * @property resolvedAddress - Stellar address resolved from a federation lookup, if applicable
 */
export interface ContactData {
  name: string;
  resolvedAddress?: string;
}

/**
 * Map of Stellar address → ContactData, keyed by the raw input address
 * (federation address or Stellar public key).
 */
export type ContactsMap = Record<string, ContactData>;
