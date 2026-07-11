---
name: 13-feature brief implementation
description: Key decisions, constraints, and lessons from implementing the 13-feature brief on top of the media upload fix.
---

## Decisions

**Media Viewer (Feature 2):** Built with FlatList+pagingEnabled for swipe (counter updates via onMomentumScrollEnd), PanResponder for drag-to-close (≥18% vertical or velocity ≥0.6), PinchGestureHandler (react-native-gesture-handler ~2.4.2) for pinch zoom, double-tap via lastTap ref + Animated.spring.  Video pages show a play button that opens URL via Linking (no react-native-video installed — can't add without native rebuild).

**Selection mode (Features 3+4):** `selectedIds: Set<string>` state in chat and group screens. Long press (delayLongPress=350) adds to set; tap in selection mode toggles. SelectionToolbar component swaps in for the normal header. Copy and Share both use `Share.share()` — no `@react-native-clipboard/clipboard` installed.

**Delete (Feature 5):** "Delete for everyone" = existing `DELETE /chats/:chatId/messages/:messageId` endpoint (soft delete, emits `message:delete` socket event). "Delete for me" = `POST .../delete-for-me` sets `metadata.deletedFor` array on backend; frontend filters out on render via `metadata.deletedForMe === true` flag (set optimistically on the message object locally, not the same field).

**Forward (Feature 6):** ForwardModal with Friends/Groups tabs. Uses `createChat` + `sendChatMessage` from DataContext. Messages are sorted chronologically before sending.

**Share (Feature 7):** `Share.share({ message: urls.join('\n') })` — Android system share sheet.

**Copy (Feature 8):** Uses `Share.share({ message: text })` — Share sheet includes "Copy to clipboard" in Android sheet. No separate clipboard package available without native rebuild.

**Read Receipts (Feature 9):** NO schema change (stored in `metadata.readBy` jsonb array and `metadata.seenAt`). Backend endpoint `POST /chats/:id/read` iterates messages, adds userId to metadata.readBy, emits `message:read` socket event. Frontend `useRealtimeMessages` handles `message:read` event and updates status to "seen". MessageStatusIcon shows green check-circle for "seen" status.

**Poll voting (Feature 13):** Backend endpoints added for chat/group/channel. Updates `metadata.options[idx].votes` array (dedup: no-op if already voted). Emits `message:vote` socket event. Frontend handles optimistically + via socket handler.

**Attachment limit (Feature 11):** Changed selectionLimit 100→50 in ChatAttachMenu.tsx line.

**Group screen hooks fix:** Moved all hooks before conditional `if (!group)` return to fix pre-existing Rules of Hooks violation.

**Group screen attach menu fix:** Now passes `ref`, `onSend`, `onSendPlaceholder`, `onResolvePlaceholder` to ChatAttachMenu — group media uploads now have placeholder progress UI.

## Why no schema migration

To avoid running `pnpm run push` on the live Neon DB (risk of prod impact), all new data (readBy, deletedFor, poll votes) is stored in the existing `metadata` jsonb column. This is a deliberate trade-off; if indexed queries are needed later, a migration to add proper columns is straightforward.

## Files changed (16)

New: MediaViewer.tsx, SelectionToolbar.tsx, ForwardModal.tsx, MessageInfoModal.tsx
Modified: MediaAlbum.tsx, MessageContent.tsx, MessageStatusIcon.tsx, ChatAttachMenu.tsx, useRealtimeMessages.ts, DataContext.tsx, types/index.ts, api.ts, chat/[id].tsx, group/[id].tsx
