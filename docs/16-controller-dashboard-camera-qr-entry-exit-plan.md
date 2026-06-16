# Controller Dashboard Camera QR Entry/Exit Plan

## Summary

The controller dashboard supports camera-based QR scanning for both entry and exit gates. Operators select separate gate devices, open the camera scanner for the required direction, and validate the public booking QR value.

A booking contains one or more tickets (determined by the ticket count or visitor combo). The validation logic allows up to $N$ entries and $N$ exits for a booking with $N$ tickets. Exit before entry is denied, and exits cannot exceed the number of currently entered visitors. 

Furthermore, access validation is museum-specific: when a ticket is scanned, the museum of the booking must match the museum of the signed-in authority/operator. Admin users bypass this check. This ensures a ticket is applicable to one specific museum only, preventing users from entering other museums.

To align with the database ER Diagram, each ticket booking includes complete User, Museum, and Purchase Ticket attributes.

## Schema Attributes (Aligned with ER Diagram)

### User Attributes
- `Name`: Full Name of the booking visitor.
- `Email`: Email address of the booking visitor.
- `Phone No`: Contact phone number of the visitor.
- `Gender`: Gender of the visitor (dropdown selection).
- `Age`: Age of the visitor (integer value).
- `Location`: Hometown/location of the visitor.

### Museum Attributes
- `Museum_ID`: ID of the booked museum.
- `Museum Name`: Name of the booked museum.
- `Museum Location`: Location address of the booked museum.
- `Price`: Price per ticket for the selected category.
- `Category`: Category classification of the booked museum.

### Purchase Ticket Attributes
- `Purchase Date and Time`: The timestamp when the booking was made (`createdAt`).
- `Visit Date`: The scheduled date of visit (`visitDate`).

## Implementation

- Update `client/src/lib/api.ts` and `client/src/lib/services/bookingService.ts` to include `gender`, `age`, and `userLocation` attributes.
- Update `client/src/components/booking/BookTicket.tsx` (booking form) with fields for Gender, Age, and User Location, performing front-end validation.
- Update `client/src/app/controller-dashboard/page.tsx` with:
  - displaying the scanned visitor's Gender, Age, and Location on the validation card.
  - separate Entry Gate and Exit Gate selectors.
  - separate camera buttons for entry and exit.
  - camera preview modal with stop and retry controls.
  - automatic validation after QR decode.
  - manual ticket ID fallback for both gate directions.
  - entry/exit badges in local scan logs.
  - passing signed-in user's email and role to the validation API.
- Extend `POST /api/bookings/validate-ticket` to accept:

```ts
{
  ticketId: string;
  deviceId: string;
  gateAction: 'entry' | 'exit';
  operatorEmail?: string;
  operatorRole?: string;
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
- Museum Authorization Check:
  - If the operator's role is not `admin`, check the museum linked to the operator's email (matching `loginEmail` in Firestore `museums`).
  - If the operator is not associated with any museum or if the booking's museum ID does not match the operator's museum ID, the scan is denied with: `Access denied - Ticket is valid for "Museum A", but this gate is managed by "Museum B"`.
- Entry:
  - Let $N$ be the total tickets in the booking.
  - Granted only if the number of previous granted entry scans is less than $N$.
  - Displays dynamic messages: `Entry granted - Ticket X of N verified successfully`.
  - Duplicate entry beyond $N$ is denied with the previous entry gate/time details.
- Exit:
  - Granted only if the number of previous granted exit scans is less than the number of previous entry scans (i.e. currently entered visitors remaining > 0) AND total exits is less than $N$.
  - Displays dynamic messages: `Exit recorded - Ticket X of N verified successfully`.
  - Exit before any entry is denied.
  - Duplicate exit beyond the currently entered count or $N$ is denied.
- Denied scans are logged with the requested `gateAction`.

## Data Notes

Scan state is read from Firebase Realtime Database `scan_logs`, matching where `controllerService.logScan` writes scan records. Older logs without `gateAction` are treated as `entry` for backward compatibility.

To optimize lookups, `scan_logs` queries filter by `ticketId` using Firebase Realtime Database indexing: `ref('scan_logs').orderByChild('ticketId').equalTo(ticketId)`.

Ticket QR values remain unchanged: the QR contains the public `bookingId`.

## Test Plan

- Run `npm run lint` from `client`.
- Run `npm run build` from `client`.
- Manual browser checks:
  - book a ticket, providing values for Gender, Age, and User Location, and complete the order.
  - sign in as a museum operator (linked to Museum A) and verify that scanning a ticket for Museum B is denied.
  - verify that scanning a ticket for Museum A is allowed up to $N$ times.
  - entry scans beyond $N$ are denied.
  - exit before entry is denied.
  - exit after entry is granted (up to the current entry count).
  - repeated exit scan beyond entered count is denied.
  - inactive/offline/maintenance gates disable scanning.
  - manual fallback follows the same rules as camera scanning.
  - local and museum dashboard scan logs show entry/exit labels and dynamic ticket counts (e.g. "Ticket X of Y").
