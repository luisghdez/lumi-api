# Timezone-Based Notifications - Quick Start Guide

## 🎉 Great News!

Your notification system **already uses timezone-based logic**! I've enhanced it with better debugging and testing capabilities.

## How It Works (Simple Version)

1. **User has timezone** (e.g., `America/New_York`)
2. **Cron job runs every hour** on your server
3. **For each user:** Calculate their local time
4. **Send notifications** based on their local time windows

## Notification Schedule (User's Local Time)

| Notification | When | Frequency |
|-------------|------|-----------|
| ☀️ Morning Motivation | 7-9 AM | Once per day |
| 🎉 Friday Celebration | Friday 11 AM - 2 PM | Once per Friday |
| 💫 Monday Lock-In | Monday 7-10 AM | Once per Monday |
| 💡 Re-engagement | 3-4 PM (after 3 days inactive) | Once per day |
| 🔥 Streak Expiring | Anytime (22-36 hours after last check-in) | Once per streak |

## Quick Test

### 1. Check a User's Timezone Status

```bash
GET /notif/timezone-check?userId={userId}
```

**Example Response:**
```json
{
  "userId": "abc123",
  "timezone": "America/New_York",
  "currentLocalTime": "2025-10-11 08:30:45",
  "hour": 8,
  "weekday": "Saturday",
  "notifications": {
    "dailyMotivation": {
      "eligible": true,
      "window": "7-9 AM local time",
      "currentHour": 8
    },
    // ... other notification windows
  }
}
```

### 2. Manually Trigger Notifications

```bash
GET /cron/reengagement
```

**Response:**
```json
{
  "sent": {
    "streakExpiring": 2,
    "dailyMotivation": 5,
    "fridayCongrats": 0,
    "mondayLockIn": 0,
    "reengaged3Days": 1
  }
}
```

### 3. Enable Debug Logging

```bash
DEBUG_NOTIFICATIONS=true npm start
```

**Output:**
```
🌍 User abc123: TZ=America/New_York, Local Time=2025-10-11 08:30:45, Hour=8
📬 Push sent to user abc123: "Good morning ☀️"
```

## Example: Morning Notification

**Scenario:**
- User in New York (EST)
- Server is in UTC
- User's local time: 8:00 AM EST
- Server time: 1:00 PM UTC

**What Happens:**
1. Cron job runs at 1:00 PM UTC
2. Fetches user's timezone: `America/New_York`
3. Calculates local time: 8:00 AM EST
4. Checks: Is 8:00 AM between 7-9 AM? ✅ Yes
5. Checks: Already sent today? ❌ No
6. **Sends notification!** 📬
7. Updates `lastDailyMotivationAt` to prevent duplicates

## Client-Side Setup

### Detect and Send Timezone

**JavaScript/TypeScript:**
```javascript
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// On user creation
await fetch('/users/ensure', {
  method: 'POST',
  body: JSON.stringify({
    email: user.email,
    name: user.name,
    timezone: timezone  // ← Send this!
  })
});
```

**Flutter/Dart:**
```dart
import 'package:timezone/timezone.dart' as tz;

final timezone = tz.local.name;  // e.g., "America/New_York"

// On user creation
await api.createUser(
  email: user.email,
  name: user.name,
  timezone: timezone,  // ← Send this!
);
```

## Files Modified

1. ✅ `src/jobs/reengagement.ts` - Added debug logging
2. ✅ `src/routes/notifRoutes.ts` - Added timezone-check endpoint

## What's Already Working

- ✅ Timezone-based notification logic (was already there!)
- ✅ Runs every hour automatically
- ✅ Prevents duplicate notifications
- ✅ Supports all IANA timezones
- ✅ Handles daylight saving time

## What's New

- ✅ Debug logging for timezone info
- ✅ Test endpoint to check notification eligibility
- ✅ Better documentation

## Common Timezones

```javascript
"America/New_York"      // EST/EDT
"America/Los_Angeles"   // PST/PDT
"America/Chicago"       // CST/CDT
"Europe/London"         // GMT/BST
"Europe/Paris"          // CET/CEST
"Asia/Tokyo"            // JST
"Asia/Shanghai"         // China
"Australia/Sydney"      // AEST/AEDT
```

## Testing Checklist

- [ ] User has timezone set in profile
- [ ] User has valid FCM token
- [ ] Test endpoint shows correct local time
- [ ] Manually trigger cron to verify notifications
- [ ] Check Firestore tracking fields update
- [ ] Verify no duplicate notifications sent

## Quick Debug

**Problem: User not getting notifications**

Run this checklist:
```bash
# 1. Check user exists and has timezone
GET /users/{userId}

# 2. Check timezone and eligibility
GET /notif/timezone-check?userId={userId}

# 3. Test FCM token
GET /notif/test?userId={userId}

# 4. Manually trigger cron
GET /cron/reengagement

# 5. Check server logs
DEBUG_NOTIFICATIONS=true npm start
```

## Production Deployment

```bash
# Build
npm run build

# Start with debug logging (optional)
DEBUG_NOTIFICATIONS=true npm start

# Cron job runs automatically every hour
# No additional setup needed!
```

## Need More Details?

See `TIMEZONE_NOTIFICATIONS.md` for comprehensive documentation including:
- All notification types and timings
- Database field reference
- Troubleshooting guide
- Customization options
- Scaling considerations

## Summary

✅ **Your notification system is timezone-aware and production-ready!**

Users everywhere get notifications at the right time in their local timezone. No more 3 AM notifications for users in different time zones! 🎉

