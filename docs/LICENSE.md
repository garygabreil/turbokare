# App license setup

Licenses are stored in Firestore and shown in the user menu (Administrator dropdown).

## Firestore document

**Collection:** `settings`  
**Document ID:** `license`

### TurboKare (yearly only)

```json
{
  "customerName": "TurboKare",
  "plan": "yearly",
  "startsAt": 1751500800000,
  "expiresAt": 1783036800000,
  "active": true
}
```

- `startsAt` / `expiresAt` are Unix timestamps in **milliseconds**
- Example above: started **3 Jul 2026**, expires **3 Jul 2027**
- With ~2 months elapsed (Sep 2026), about **304 days left**

### GaragePro (monthly / quarterly / yearly)

Use the same document shape with `"plan": "monthly"`, `"quarterly"`, or `"yearly"`.

| Plan | Duration |
|------|----------|
| `monthly` | 1 month from `startsAt` |
| `quarterly` | 3 months from `startsAt` |
| `yearly` | 12 months from `startsAt` |

## Product mode (per deployment)

Set in `src/environments/environment.prod.ts`:

| Product | `product.mode` | Allowed plans |
|---------|----------------|---------------|
| **TurboKare** | `turbokare` | Yearly only |
| **GaragePro** | `garagepro` | Monthly, quarterly, yearly |

For generic GaragePro builds, use `src/environments/environment.garagepro.ts` in `angular.json` fileReplacements.

## Fallback

If no Firestore document exists:

- **TurboKare** — uses default yearly license from 3 Jul 2026
- **GaragePro** — uses a 1-month demo license from today

## UI behaviour

- User dropdown shows **plan**, **expiry date**, and **days left**
- Navbar pill shows days remaining (e.g. `304d`)
- Warning banner when **≤ 30 days** left
- Red banner when **expired**

## Renewing a license

Update `expiresAt` (and optionally `startsAt`) in Firestore, or set `active: true` after payment.

To extend yearly TurboKare by another year:

```json
{
  "expiresAt": 1814572800000
}
```

(Calculate new timestamp for the new expiry date.)
