# Architecture rules
- Client self-registration uses single-use, expiring, hashed invitation tokens redeemed atomically through narrowly scoped database functions; public callers cannot browse clients or loans.
- Manual and public client registration share field definitions and validation to keep the collected personal data consistent.