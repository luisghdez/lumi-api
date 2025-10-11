# Enhanced Streak Logic - Timezone-Based Calendar Days

## Overview

The streak system has been enhanced to use **timezone-based calendar days** instead of a fixed 12-hour window. This means users can maintain their streak by completing a lesson on any calendar day in their local timezone.

## Key Improvements

### Before
- Streaks were calculated based on UTC time or a 12-hour window
- Users had to wait 12 hours between lessons to increment their streak
- Did not account for user's local timezone

### After
- Streaks are calculated based on the user's actual timezone
- Each calendar day (midnight to midnight in user's timezone) can count toward a streak
- If a user completes a lesson at 10pm on Monday, they can complete another lesson at 1am on Tuesday (in their timezone) and maintain/extend their streak
- More intuitive and fair for users across different timezones

## How It Works

### Streak Calculation Logic

1. **Same Calendar Day** (dayDiff = 0):
   - Streak count remains unchanged
   - User already completed a lesson today
   
2. **Next Calendar Day** (dayDiff = 1):
   - Streak count increments by 1
   - User is maintaining their daily streak
   
3. **Missed 2+ Days** (dayDiff ≥ 2):
   - Streak resets to 1
   - User broke their streak

### Streak Reset on Login

The `checkStreakOnLogin` function now:
- Only resets the streak if 2+ calendar days have passed
- Allows a 1-day grace period (users who missed yesterday can still recover today)
- Uses the user's timezone for accurate day calculations

## Database Schema

### User Document Fields

New field added to user documents:

```typescript
{
  // ... existing fields
  timezone: string; // IANA timezone identifier (e.g., "America/New_York", "Europe/London")
  streakCount: number;
  lastCheckIn: Timestamp;
}
```

### Default Value
- If no timezone is provided, the system defaults to `"UTC"`
- Existing users without a timezone field will use UTC until they update their profile

## API Endpoints

### 1. Create User (with Timezone)

**POST** `/users/ensure`

**Body:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "profilePicture": "https://...",
  "timezone": "America/New_York"
}
```

### 2. Update User Profile (with Timezone)

**PUT** `/users/profile`

**Body:**
```json
{
  "name": "Jane Doe",
  "profilePicture": "https://...",
  "timezone": "America/Los_Angeles"
}
```

### 3. Mark Lesson Completed (Triggers Streak Update)

**POST** `/saved-courses/:courseId/lessons/:lessonId/complete`

**Body:**
```json
{
  "xp": 10
}
```

**Response:**
```json
{
  "message": "Lesson marked as completed, XP updated, and streak checked.",
  "streakInfo": {
    "previousStreak": 5,
    "newStreak": 6,
    "streakExtended": true
  }
}
```

## Client-Side Implementation

### Getting User's Timezone

#### JavaScript/TypeScript
```javascript
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
// Returns: "America/New_York", "Europe/London", etc.
```

#### Flutter/Dart
```dart
import 'package:timezone/timezone.dart' as tz;

String getTimezone() {
  return tz.local.name;
  // Returns: "America/New_York", "Europe/London", etc.
}
```

### Example: Setting Timezone on User Creation

```typescript
// When creating a user account
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

await fetch('/users/ensure', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    email: user.email,
    name: user.name,
    timezone: timezone // Automatically detected
  })
});
```

### Example: Updating Timezone

```typescript
// When user changes location or wants to update timezone
const newTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

await fetch('/users/profile', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    timezone: newTimezone
  })
});
```

## Valid Timezone Values

Use **IANA timezone identifiers**. Common examples:

### Americas
- `America/New_York` - Eastern Time
- `America/Chicago` - Central Time
- `America/Denver` - Mountain Time
- `America/Los_Angeles` - Pacific Time
- `America/Sao_Paulo` - Brazil
- `America/Mexico_City` - Mexico

### Europe
- `Europe/London` - UK
- `Europe/Paris` - France
- `Europe/Berlin` - Germany
- `Europe/Madrid` - Spain

### Asia
- `Asia/Tokyo` - Japan
- `Asia/Shanghai` - China
- `Asia/Dubai` - UAE
- `Asia/Kolkata` - India

### Pacific
- `Australia/Sydney` - Australia
- `Pacific/Auckland` - New Zealand

[Full list of IANA timezones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

## Example Scenarios

### Scenario 1: Late Night Learning
- User timezone: `America/New_York` (EST)
- Monday 11:00 PM EST: User completes a lesson (streak = 5)
- Tuesday 12:30 AM EST: User completes another lesson
- Result: Streak increments to 6 ✅

### Scenario 2: Cross-Timezone Travel
- User travels from New York to Tokyo
- Updates timezone from `America/New_York` to `Asia/Tokyo`
- Streak calculations now use Tokyo time
- Can complete lessons based on Tokyo calendar days

### Scenario 3: Missed a Day
- Wednesday 10:00 PM: User completes a lesson (streak = 10)
- Thursday: User misses their lesson
- Friday 8:00 AM: User completes a lesson
- Result: dayDiff = 2, streak resets to 1 ⚠️

## Milestone Notifications

Users receive push notifications at streak milestones:
- 5 days 🔥
- 10 days 🔥🔥
- 20 days 🔥🔥🔥
- 30 days 🔥🔥🔥🔥

These are triggered in `updateUserStreak` after a successful streak extension.

## Testing

### Manual Testing Steps

1. **Test Same Day (No Streak Increment)**
   ```bash
   # Complete two lessons on the same day
   # Expected: Streak stays the same
   ```

2. **Test Next Day (Streak Increment)**
   ```bash
   # Complete lesson today, then tomorrow
   # Expected: Streak increments by 1
   ```

3. **Test Timezone Change**
   ```bash
   # Update user timezone
   # Complete lesson using new timezone
   # Expected: Streak calculated based on new timezone
   ```

4. **Test Missed Days (Streak Reset)**
   ```bash
   # Complete lesson, wait 2+ days, complete another
   # Expected: Streak resets to 1
   ```

## Code Files Modified

1. **`src/services/streakService.ts`**
   - Updated `updateUserStreak` to use user's timezone
   - Updated `checkStreakOnLogin` to use user's timezone
   - Changed reset condition from `dayDiff >= 1` to `dayDiff >= 2` for grace period

2. **`src/services/userService.ts`**
   - Added `timezone` field to `UserProfileData` interface
   - Added `timezone` to user creation in `createFireStoreUser`
   - Added `timezone` update support in `updateFireStoreUser`

3. **`src/controllers/userController.ts`**
   - Added `timezone` parameter to `ensureUserExistsController`
   - Added `timezone` parameter to `updateUserProfileController`

## Migration Notes

### For Existing Users

Existing users who don't have a `timezone` field will:
1. Default to UTC for streak calculations
2. Can update their timezone at any time via the profile update endpoint
3. Should be prompted to set their timezone on next app update

### Database Migration (Optional)

To backfill timezones for existing users, you can run a migration script:

```typescript
// Example migration script
async function backfillTimezones() {
  const usersSnapshot = await db.collection('users').get();
  
  for (const doc of usersSnapshot.docs) {
    if (!doc.data().timezone) {
      await doc.ref.update({
        timezone: 'UTC' // or infer from user's location data
      });
    }
  }
}
```

## Best Practices

1. **Always detect and send timezone from client**
   - Use native APIs to get accurate timezone
   - Update timezone if user travels

2. **Handle timezone updates gracefully**
   - Allow users to manually change their timezone
   - Consider showing timezone in user profile

3. **Display times in user's timezone**
   - Show "last completed" times in user's local time
   - Show streak deadlines in user's local time

4. **Validate timezone values**
   - Ensure timezone is a valid IANA identifier
   - Fallback to UTC if invalid

## Troubleshooting

### Issue: Streak not incrementing
- Check user's timezone is set correctly
- Verify lessons are being marked as completed
- Check `lastCheckIn` timestamp in user document

### Issue: Streak resetting unexpectedly
- Verify user completed lessons on consecutive calendar days in their timezone
- Check for gaps greater than 1 day

### Issue: Wrong day calculation
- Ensure timezone string is a valid IANA identifier
- Check that server time is accurate
- Verify `calendarDayDiff` function is receiving correct timezone

## Future Enhancements

Potential improvements to consider:

1. **Freeze Streaks**
   - Allow users to "freeze" their streak for vacation days
   - Premium feature: 1-2 freeze days per month

2. **Streak Recovery**
   - Grace period notifications (e.g., "You have 3 hours to complete a lesson!")
   - One-time streak recovery purchase

3. **Leaderboards**
   - Global streak leaderboards
   - Friend streak comparisons

4. **Analytics**
   - Track streak completion patterns by timezone
   - Identify optimal notification times per timezone

