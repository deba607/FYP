# Bharat Museum 
Backend and frontend are now consolidated into one Next.js App Router project with API routes under `src/app/api`.

## Step-by-Step Migration Plan

1. **Create backend foundation in Next.js**
   - Add DB singleton: `src/lib/db/mongoose.ts`
   - Add Firebase Admin singleton: `src/lib/config/firebaseAdmin.ts`
   - Add reusable auth middleware helpers: `src/lib/middleware/auth.ts`
   - Add standardized JSON response/error utilities: `src/lib/utils/*`

2. **Move models to Next project**
   - `src/models/User.ts`
   - `src/models/Booking.ts`

3. **Move controllers to services layer**
   - `src/lib/services/authService.ts`
   - `src/lib/services/bookingService.ts`
   - `src/lib/services/chatService.ts`
   - Services contain business logic only and are request/response independent.

4. **Convert routes to App Router route handlers**
   - `src/app/api/auth/login/route.ts`
   - `src/app/api/auth/signup/route.ts`
   - `src/app/api/bookings/...`
   - `src/app/api/chat/...`

5. **Remove Express runtime**
   - Delete `server/server.js`
   - No `app.listen()` and no Express bootstrap.

6. **Normalize frontend API calls**
   - Use relative calls only: `fetch('/api/...')`

## Final Structure

```
client/
  src/
    app/
      api/
        auth/
        bookings/
        chat/
        health/
        uploads/
    lib/
      config/
      db/
      middleware/
      services/
      utils/
    models/
    components/
    hooks/
    assets/
  public/
```

## Express Route → Next Route Example

### Express

```js
router.post('/login', loginUser);
```

### Next.js App Router

```ts
import { NextRequest } from 'next/server';
import { loginUser } from '@/lib/services/authService';
import { jsonError, jsonSuccess } from '@/lib/utils/apiResponse';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await loginUser(body);
    return jsonSuccess(result, 200);
  } catch (error) {
    return jsonError((error as Error).message, 500);
  }
}
```

## Controller → Service Example

Controller-style logic is moved into pure service functions:

```ts
export async function createBooking(input: CreateBookingInput) {
  await connectToDatabase();
  const booking = await BookingModel.create({ ...input, bookingId: generateBookingId() });
  return { success: true, booking };
}
```

## Environment Variables (`.env.local`)

```env
NEXT_PUBLIC_API_URL=/api

MONGODB_URI=mongodb://127.0.0.1:27017/bharat-museum
JWT_SECRET=replace-with-strong-secret
CHATBOT_ENGINE_URL=http://localhost:5001

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Rules:
- Server-only secrets must not use `NEXT_PUBLIC_`.
- Only client-safe values use `NEXT_PUBLIC_*`.

## File Upload Handling (No Multer)

Use route handlers + `formData()`:

```ts
const formData = await req.formData();
const file = formData.get('file');
```

Reference implementation: `src/app/api/uploads/route.ts`.

## Error Handling Standard

- Use `ApiError` for typed business errors.
- Use `jsonSuccess` / `jsonError` for response consistency.
- Keep route handlers thin; keep business logic in services.

## Deployment Notes (Vercel)

- Route handlers are serverless-friendly.
- Avoid long-running tasks inside API handlers.
- Move cron, queues, or workers to external services.
- Firebase Admin and Mongoose are singleton-initialized for reuse across invocations.

## Common Mistakes to Avoid

- Initializing MongoDB/Firebase on every request instead of singleton reuse.
- Putting business logic directly in route handlers.
- Exposing private env values through `NEXT_PUBLIC_*`.
- Keeping stale Express files active after migration.
- Using Node-only APIs in Edge runtime unintentionally (set `runtime = 'nodejs'` where required).
