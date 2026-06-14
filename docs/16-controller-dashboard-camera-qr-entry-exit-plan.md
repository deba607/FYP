# Controller Dashboard Camera QR Entry/Exit Plan

## Summary

The controller dashboard supports camera-based QR scanning for both entry and exit gates. Operators select separate gate devices, open the camera scanner for the required direction, and validate the public booking QR value.

A ticket may enter once and then exit once. Exit before entry is denied. Manual ticket ID entry remains available as a fallback for testing, unsupported browsers, or camera permission issues.

## Implementation

- Add `@zxing/browser` to the Next.js client for browser QR decoding.
- Update `client/src/app/controller-dashboard/page.tsx` with:
  - separate Entry Gate and Exit Gate selectors
  - separate camera buttons for entry and exit
  - camera preview modal with stop and retry controls
  - automatic validation after QR decode
  - manual ticket ID fallback for both gate directions
  - entry/exit badges in local scan logs
- Extend `POST /api/bookings/validate-ticket` to accept:

```ts
{
  ticketId: string;
  deviceId: string;
  gateAction: 'entry' | 'exit';
}
```

- Extend Realtime Database scan logs with:

```ts
{
  ticketId: string;
  deviceId: string;
  deviceName: string;
  scannedAt: string;
  outcome: 'granted' | 'denied';
  gateAction: 'entry' | 'exit';
  message: string;
}
```

## Validation Rules

- Shared checks:
  - ticket must exist
  - ticket must not be cancelled
  - ticket must be paid or confirmed
  - visit date must match the current Kolkata date
- Entry:
  - granted only if no previous granted entry scan exists
  - duplicate entry is denied with the previous gate/time
- Exit:
  - granted only after a previous granted entry scan
  - duplicate exit is denied with the previous gate/time
  - exit before entry is denied
- Denied scans are logged with the requested `gateAction`.

## Data Notes

Scan state is read from Firebase Realtime Database `scan_logs`, matching where `controllerService.logScan` writes scan records. Older logs without `gateAction` are treated as `entry` for backward compatibility.

Ticket QR values remain unchanged: the QR contains the public `bookingId`.

## Test Plan

- Run `npm run lint` from `client`.
- Run `npm run build` from `client`.
- Manual browser checks:
  - entry camera scans a valid QR and grants access
  - repeated entry scan is denied
  - exit before entry is denied
  - exit after entry is granted
  - repeated exit scan is denied
  - inactive/offline/maintenance gates disable scanning
  - manual fallback follows the same rules as camera scanning
  - local and museum dashboard scan logs show entry/exit labels
