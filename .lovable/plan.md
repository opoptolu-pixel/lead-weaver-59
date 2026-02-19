
# Fix: Double Message on Admin Reply

## Root Cause

In `src/pages/admin/AdminSupport.tsx`, the `sendMessage` function (lines 135–167) has a race condition that causes the sent message to appear twice:

1. The admin sends a message — it is inserted into the database.
2. The Supabase Realtime channel (`admin-tickets`) receives the `INSERT` event and appends the message to local state.
3. **Also inside `sendMessage`**, line 164 calls `await fetchMessages(selectedTicket.id)` which does a full database re-fetch and calls `setMessages(data || [])` — replacing state with all messages including the new one.

Both paths add the same message to the UI. The deduplication guard (`if (prev.some((m) => m.id === msg.id)) return prev`) on the realtime listener would only catch the duplicate if the message was already in state before the listener fires. Since `fetchMessages` **replaces** state entirely (not appends), the realtime event arrives slightly after and sees the message isn't "some"d into state by ID yet in that render cycle — or vice versa — causing both to succeed.

## The Fix

Remove the `await fetchMessages(selectedTicket.id)` call from inside `sendMessage`. The Realtime subscription already handles appending new messages to the UI instantly. The full re-fetch is redundant and is the source of the duplicate.

The only state update needed after a successful insert is:
- Clear `newMessage` — already done on line 165
- Set `sending = false` — already done on line 166
- Optionally update the ticket status to `in_progress` — already done on lines 158–161

## Technical Details

### File to Change
`src/pages/admin/AdminSupport.tsx`

### Change Required
Remove line 163-164:
```
// Refresh messages to ensure consistency
await fetchMessages(selectedTicket.id);
```

The `sendMessage` function will become:

```typescript
const sendMessage = async () => {
  if (!newMessage.trim() || !selectedTicket || !adminId) return;
  setSending(true);
  
  const { error } = await supabase.from("support_messages").insert({
    ticket_id: selectedTicket.id,
    sender_id: adminId,
    sender_type: "admin",
    message: newMessage.trim(),
  });

  if (error) {
    console.error("Failed to send message:", error);
    toast({
      title: "Failed to send message",
      description: error.message,
      variant: "destructive",
    });
    setSending(false);
    return;
  }

  // If ticket is still "open", move to in_progress
  if (selectedTicket.status === "open") {
    await supabase.from("support_tickets").update({ status: "in_progress" }).eq("id", selectedTicket.id);
    setSelectedTicket({ ...selectedTicket, status: "in_progress" });
  }

  setNewMessage("");
  setSending(false);
};
```

The Realtime subscription (lines 69–83) already handles adding the new message to the UI immediately — with its deduplication check (`if (prev.some((m) => m.id === msg.id)) return prev`) — so no message will be lost.

## Why This is Safe

- The realtime listener fires almost instantly after the DB insert, so there is no perceptible delay in the message appearing.
- The deduplication guard on the realtime listener ensures no duplicates even in edge cases.
- The `fetchMessages` full re-fetch was only needed if realtime wasn't in place — it's now redundant.
