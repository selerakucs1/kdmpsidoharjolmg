# Security Specification for KDMP Sidoharjo

## 1. Data Invariants
- A saving must belong to a member.
- A loan must belong to a member and have a valid amount.
- An item must have a price and stock >= 0.
- Only authenticated users (admins/staff) can manage the data. (For this app, since it's a village cooperative, we'll assume a few trusted accounts).

## 2. Dirty Dozen Payloads
- Creating a member with an ID that isn't a string.
- Updating a loan's `remainingAmount` to a negative value.
- Injecting a 2MB string into a member's name.
- Creating a transaction without items.
- Modifying `createdAt` on a member record.
- Deleting a member that has active loans.
- Updating a saving's `amount` without permission.
- Spoofing `memberId` on a new loan.
- Accessing PII of another member without being an admin.
- Setting `status` of a loan to `approved` as a normal member.
- Changing `price` of an item to 0.
- Creating a member with a missing `status` field.

## 3. Test Runner (Conceptual)
`firestore.rules.test.ts` will verify these payloads are rejected.
