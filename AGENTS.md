# Architecture rules
- Client/loan list refreshes retain the previous query result while fetching so open loan and payment forms stay mounted and preserve unsaved input.
- Client self-registration uses single-use, expiring, hashed invitation tokens redeemed atomically through narrowly scoped database functions; public callers cannot browse clients or loans.
- Manual and public client registration share field definitions and validation to keep the collected personal data consistent.
- Registration identity photos belong to clients and are stored in private Storage; a token-validated edge function uploads them and atomically redeems the invitation, while owners view them through short-lived signed URLs in each loan.