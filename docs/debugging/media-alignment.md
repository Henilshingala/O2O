# Media Message Alignment Debugging Guide

## The Problem
Outgoing media messages (Images, Videos, Audio, Documents, Locations, and Polls) incorrectly appeared on the left side of the Android chat interface, while text messages correctly appeared on the right.

Despite multiple layout fixes (e.g., adding `alignSelf: flex-end`), the UI consistently failed to update.

## The Root Causes
This issue was the result of two independent bugs—one layout flaw and one architectural freeze:

1. **The Layout Bug:**
   The `MessageContent` wrapper for media components (`styles.wrapper`) lacked explicit cross-axis alignment (`alignSelf`). Because its child (`statusRow`) expanded to fill available space, the `wrapper` expanded to 100% width, neutralizing the parent container's `alignItems: flex-end` logic. The fix was to mirror the `ChatBubble` behavior by applying `alignSelf: isMine ? "flex-end" : "flex-start"` directly to the wrapper.

2. **The "Silent Freeze" (Why Fixes Didn't Work):**
   The layout fix was implemented, but the physical device never updated. The root cause was an infinite render loop in `AuthContext.tsx`. 
   - `cacheUser` was updating state and unconditionally returning a new object reference on every invocation.
   - `FriendsProvider` ran a `useEffect` that iterated over all friends and called `cacheUser`.
   - This caused `AuthContext` to re-render, which cascaded to `FriendsProvider`, triggering the `useEffect` again.
   - Result: React Native was permanently locked at the root `_layout.tsx` level with `Maximum update depth exceeded`, silently blocking all UI reconciliation.

## Systematic Debugging Workflow
If a similar rendering or layout issue occurs, follow this workflow exactly to avoid wasted effort and blind experimentation:

1. **Verify Data Integrity First:**
   Never assume a layout issue without verifying the data. Trace the payload (`senderId`, `currentUserId`, `isMine`) from the Socket.IO event all the way to the final component props. Only proceed if the data is confirmed correct.
2. **Trace the Render Pipeline:**
   Verify exactly which component is being rendered. Add explicit `console.log` statements inside the component render function.
3. **Verify the App is Alive (Check for Freezes):**
   If `console.log` statements do not appear in Metro or `adb logcat`, **STOP**. The app is not running your code. Check for:
   - Stale Metro/APK bundles
   - Fatal rendering crashes (e.g., referencing undefined variables)
   - Infinite render loops (`Maximum update depth exceeded`)
4. **Isolate the Layout Bug:**
   Once you prove the correct code is running, use React Native Inspector (or Yoga theoretical analysis) to trace the exact Flexbox parent hierarchy. Look for `flex: 1` or `width: 100%` on intermediate containers that neutralize parent `alignItems`.
5. **Apply the Fix:**
   Only modify styles after the exact breaking container is identified.

*Remember: Never jump directly to changing styles without first proving the data flow and confirming the React tree is actually updating.*
