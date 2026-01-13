# Promote From Waitlist - Database RPC Function

## Overview

This document contains the SQL code for the `promote_from_waitlist` database RPC function, which atomically promotes the top person from the waitlist when a ticket is cancelled.

## Purpose

When a ticket is cancelled, this function:

1. Locks the waitlist table to prevent race conditions
2. Retrieves the person with the lowest position (first in line)
3. Returns their information (email, referral code)
4. Removes them from the waitlist
5. Automatically shifts all remaining positions down by 1

## SQL Function Definition

```sql
CREATE OR REPLACE FUNCTION promote_from_waitlist(
  p_event_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promoted_entry RECORD;
  v_promoted_position INTEGER;
BEGIN
  -- Lock all waitlist entries for this event (prevents race conditions)
  -- This ensures atomic position recalculation
  PERFORM 1 FROM waitlist
  WHERE event_id = p_event_id
  FOR UPDATE;

  -- Get the top waitlist entry (lowest position number = first in line)
  SELECT id, email, referral, position
  INTO v_promoted_entry
  FROM waitlist
  WHERE event_id = p_event_id
  ORDER BY position ASC
  LIMIT 1;

  -- If no one is on the waitlist, return null/empty result
  IF v_promoted_entry.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No one on waitlist'
    );
  END IF;

  -- Store the position for later use
  v_promoted_position := v_promoted_entry.position;

  -- Delete the promoted entry from waitlist
  DELETE FROM waitlist
  WHERE id = v_promoted_entry.id;

  -- Atomically recalculate positions for all remaining users
  -- Decrement position by 1 for everyone after the promoted user
  UPDATE waitlist
  SET position = position - 1
  WHERE event_id = p_event_id
    AND position > v_promoted_position;

  -- Return the promoted user's information for ticket creation
  RETURN jsonb_build_object(
    'success', true,
    'email', v_promoted_entry.email,
    'referral', v_promoted_entry.referral,
    'old_position', v_promoted_position
  );
END;
$$;
```

## How to Deploy

### Option 1: Supabase Dashboard (SQL Editor)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the SQL function above
5. Click **Run** to execute

### Option 2: Supabase CLI (Migration)

1. Create a new migration file:

   ```bash
   supabase migration new promote_from_waitlist
   ```

2. Add the SQL function to the migration file

3. Apply the migration:
   ```bash
   supabase db push
   ```

### Option 3: Direct Database Access

If you have direct PostgreSQL access:

```bash
psql <your-connection-string> -f promote_from_waitlist.sql
```

## Return Value

The function returns a JSON object:

### Success Case (someone promoted)

```json
{
  "success": true,
  "email": "user@stanford.edu",
  "referral": "abc123" or null,
  "old_position": 1
}
```

### Empty Waitlist Case

```json
{
  "success": false,
  "message": "No one on waitlist"
}
```

## Integration with Tickets API

Update the code in `/app/api/tickets/route.ts` in the `DELETE` handler:

### Current Implementation (Manual Query)

```typescript
// Pull the top person off the waitlist (if any)
const { data: topWaitlistEntry } = await adminClient
  .from("waitlist")
  .select("email, referral, event_id")
  .eq("event_id", event_id)
  .order("position", { ascending: true })
  .limit(1)
  .single();

if (topWaitlistEntry) {
  // Create ticket...
  // Delete from waitlist...
  // No automatic position shifting!
}
```

### New Implementation (Using RPC)

```typescript
// Pull the top person off the waitlist (if any) - ATOMIC with position shifting
const { data: promotedData, error: promoteError } = await adminClient.rpc(
  "promote_from_waitlist",
  { p_event_id: event_id },
);

if (!promoteError && promotedData?.success && promotedData?.email) {
  // Create ticket for the promoted user
  const { data: newTicket } = await adminClient
    .from("tickets")
    .insert({
      event_id: event_id,
      email: promotedData.email,
      type: "STANDARD",
    })
    .select(
      `
      id,
      email,
      type,
      event_id,
      events (
        id,
        name,
        route,
        start_time_date,
        venue,
        venue_link,
        desc
      )
    `,
    )
    .single();

  // Update referral records if they had a referral code
  if (promotedData.referral) {
    await updateReferralRecords(event_id, promotedData.email);
  }

  // Send ticket email to the promoted user
  if (newTicket) {
    try {
      const event = Array.isArray(newTicket.events)
        ? newTicket.events[0]
        : newTicket.events;
      await sendTicketEmail({
        email: newTicket.email,
        eventName: event?.name || "Event",
        ticketType: newTicket.type || "STANDARD",
        eventStartTime: event?.start_time_date || null,
        eventRoute: event?.route || null,
        ticketId: newTicket.id,
        eventVenue: event?.venue || null,
        eventVenueLink: event?.venue_link || null,
        eventDescription: event?.desc || null,
      });
      console.log(
        `Ticket created for promoted waitlist user ${promotedData.email} (was position ${promotedData.old_position})`,
      );
    } catch (emailError) {
      console.error("Error sending ticket email to waitlist user:", emailError);
      // Don't fail the cancellation if email fails
    }
  }
}
```

## Key Features

### 1. **Atomic Operation**

- Uses `FOR UPDATE` lock to prevent race conditions
- All operations (select, delete, update positions) happen within a single transaction
- No risk of position conflicts when multiple tickets are cancelled simultaneously

### 2. **Automatic Position Shifting**

- When someone is promoted, everyone else's position automatically decrements
- Position 2 becomes position 1, position 3 becomes position 2, etc.
- Maintains correct queue order

### 3. **Consistent with Existing RPCs**

- Follows the same pattern as `join_waitlist` and `leave_waitlist`
- Uses `SECURITY DEFINER` for elevated permissions
- Returns JSONB for flexible data structure
- Uses proper error handling with NULL checks

### 4. **Position-Agnostic**

- Uses `ORDER BY position ASC` instead of assuming position = 1
- Handles edge cases where positions might not start at 1
- Robust against data inconsistencies

### 5. **Safe Failure Handling**

- Returns `success: false` if waitlist is empty (not an error)
- Allows the ticket cancellation to succeed even if no one is waiting
- Non-blocking for the main operation

## Testing

### Test Case 1: Promote from non-empty waitlist

```sql
-- Setup: Create waitlist entries
INSERT INTO waitlist (event_id, email, position) VALUES
  ('event-uuid', 'user1@test.com', 1),
  ('event-uuid', 'user2@test.com', 2),
  ('event-uuid', 'user3@test.com', 3);

-- Execute
SELECT promote_from_waitlist('event-uuid');

-- Expected result:
-- Returns: {"success": true, "email": "user1@test.com", "referral": null, "old_position": 1}
-- user1 removed from waitlist
-- user2 now has position 1
-- user3 now has position 2
```

### Test Case 2: Promote from empty waitlist

```sql
-- Setup: No waitlist entries
DELETE FROM waitlist WHERE event_id = 'event-uuid';

-- Execute
SELECT promote_from_waitlist('event-uuid');

-- Expected result:
-- Returns: {"success": false, "message": "No one on waitlist"}
-- No errors thrown
```

### Test Case 3: Concurrent promotions (race condition test)

```sql
-- In two separate transactions simultaneously:
-- Transaction 1:
BEGIN;
SELECT promote_from_waitlist('event-uuid');
COMMIT;

-- Transaction 2:
BEGIN;
SELECT promote_from_waitlist('event-uuid');
COMMIT;

-- Expected result:
-- Only one transaction succeeds at a time due to FOR UPDATE lock
-- No position conflicts
-- Positions remain consistent
```

## Performance Considerations

- **Lock Duration**: The `FOR UPDATE` lock is held only during the function execution
- **Index Recommendation**: Ensure index on `waitlist(event_id, position)` for fast lookups
- **Scalability**: Works efficiently even with large waitlists (100+ people)

## Security

- **SECURITY DEFINER**: Function runs with creator's permissions (bypasses RLS)
- **search_path = public**: Prevents schema injection attacks
- **No authentication required**: Can be called by service role (backend only)

## Permissions

Grant execute permissions as needed:

```sql
-- For service role (backend API calls)
GRANT EXECUTE ON FUNCTION promote_from_waitlist(UUID) TO service_role;

-- For authenticated users (if needed)
GRANT EXECUTE ON FUNCTION promote_from_waitlist(UUID) TO authenticated;

-- For anonymous users (usually not recommended)
-- GRANT EXECUTE ON FUNCTION promote_from_waitlist(UUID) TO anon;
```

## Rollback

To remove the function:

```sql
DROP FUNCTION IF EXISTS promote_from_waitlist(UUID);
```

## Related Functions

This function complements the existing waitlist RPCs:

- `join_waitlist(p_event_id, p_referral)` - Add user to waitlist
- `leave_waitlist(p_event_id)` - User voluntarily leaves waitlist
- `promote_from_waitlist(p_event_id)` - System promotes top user (this function)

## Future Enhancements

Possible improvements:

1. Add event existence validation
2. Return the new total waitlist count
3. Support bulk promotions (promote N users at once)
4. Add audit logging for promoted users
5. Support priority waitlist (VIP users promoted first)
