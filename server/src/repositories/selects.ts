/** The public fields needed to describe "the other party" — never contact details or balances. */
export const counterpartyUserSelect = {
  id: true,
  fullName: true,
  username: true,
  avatarUrl: true,
  role: true,
  businessProfile: { select: { businessName: true, logoUrl: true } },
} as const;
