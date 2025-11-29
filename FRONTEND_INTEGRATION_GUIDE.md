# 🎮 Frontend Integration Guide - XP & Gamification System

## Quick Start

This guide helps you integrate the new XP & Gamification system into your React Native app.

---

## 📋 Overview

The gamification system includes:
- **XP (Experience Points)** - Earned from activities
- **Levels** - Calculated from total XP
- **Daily Goals** - 5 core activities to complete daily
- **Progress Tracking** - Visual feedback on achievements

---

## 🔧 Step 1: Update Your Session Tracking

### Before (Old Code)
```javascript
const trackSession = async (startTime, endTime, duration) => {
  await fetch('/api/users/app-session', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionStartTime: startTime,
      sessionEndTime: endTime,
      durationSeconds: duration,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  });
};
```

### After (New Code with Activities)
```javascript
const trackSession = async (startTime, endTime, duration, activities = []) => {
  const response = await fetch('/api/users/app-session', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionStartTime: startTime,
      sessionEndTime: endTime,
      durationSeconds: duration,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      activities: activities  // NEW: Add activities array
    })
  });
  
  const data = await response.json();
  
  // Handle response
  if (data.success) {
    // Update UI with new XP and level
    updateUserLevel(data.data.level, data.data.totalXP);
    updateDailyGoals(data.data.dailyGoals);
    
    // Check for level up
    if (data.data.xpToNextLevel < 100) {
      showLevelUpAnimation(data.data.level);
    }
  }
  
  return data;
};
```

---

## 🎯 Step 2: Track Activities

### Create Activity Tracker

```javascript
// Create a global activity tracker
class ActivityTracker {
  constructor() {
    this.activities = [];
  }
  
  // Track when user completes an activity
  track(activityType, xpEarned) {
    this.activities.push({
      type: activityType,
      timestamp: new Date().toISOString(),
      xpEarned: xpEarned
    });
    
    console.log(`Activity tracked: ${activityType} (+${xpEarned} XP)`);
  }
  
  // Get all activities and clear
  getAndClear() {
    const activities = [...this.activities];
    this.activities = [];
    return activities;
  }
  
  // Get activity count
  getCount() {
    return this.activities.length;
  }
}

// Create global instance
export const activityTracker = new ActivityTracker();
```

### Track Activities Throughout App

```javascript
// When user reads daily verse
import { activityTracker } from './ActivityTracker';

// In DailyVerseScreen.js
const handleVerseRead = async () => {
  // ... show verse ...
  
  // Track the activity
  activityTracker.track('daily_verse_read', 10);
};

const handleVerseListen = async () => {
  // ... play audio ...
  
  // Track the activity
  activityTracker.track('daily_verse_listened', 15);
};

// In DailyPrayerScreen.js
const handlePrayerRead = () => {
  activityTracker.track('daily_prayer_read', 10);
};

// In AIChatScreen.js
const sendMessage = (message) => {
  // ... send message ...
  
  // Track each message
  activityTracker.track('ai_chat_message', 5);
};

// In CommunityScreen.js
const createPost = () => {
  // ... create post ...
  
  activityTracker.track('community_post', 10);
};
```

---

## 📱 Step 3: Send Activities on App Close

```javascript
// In App.js or main navigation file
import { AppState } from 'react-native';
import { activityTracker } from './ActivityTracker';

const [appState, setAppState] = useState(AppState.currentState);
const sessionStartTime = useRef(new Date());

useEffect(() => {
  const subscription = AppState.addEventListener('change', nextAppState => {
    if (appState.match(/active/) && nextAppState === 'background') {
      // App is going to background - send activities
      const sessionEndTime = new Date();
      const duration = Math.floor((sessionEndTime - sessionStartTime.current) / 1000);
      const activities = activityTracker.getAndClear();
      
      trackSession(
        sessionStartTime.current.toISOString(),
        sessionEndTime.toISOString(),
        duration,
        activities  // Send all tracked activities
      );
    } else if (nextAppState === 'active') {
      // App is coming to foreground - reset timer
      sessionStartTime.current = new Date();
    }
    
    setAppState(nextAppState);
  });
  
  return () => {
    subscription.remove();
  };
}, [appState]);
```

---

## 📊 Step 4: Display User Stats

### Get Current Stats

```javascript
const getUserStats = async () => {
  const response = await fetch('/api/users/app-session', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    return data.data;
  }
};
```

### Create Stats Display Component

```javascript
// UserStatsCard.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ProgressBar } from 'react-native';

const UserStatsCard = ({ token }) => {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    loadStats();
  }, []);
  
  const loadStats = async () => {
    const response = await fetch('/api/users/app-session', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.success) {
      setStats(data.data);
    }
  };
  
  if (!stats) return null;
  
  return (
    <View style={styles.container}>
      {/* Level Display */}
      <View style={styles.levelSection}>
        <Text style={styles.levelLabel}>Level {stats.level}</Text>
        <Text style={styles.xpText}>
          {stats.totalXP} XP ({stats.xpToNextLevel} to next level)
        </Text>
        <ProgressBar 
          progress={1 - (stats.xpToNextLevel / 100)} 
          color="#4CAF50"
        />
      </View>
      
      {/* Daily Goals */}
      <View style={styles.goalsSection}>
        <Text style={styles.goalsTitle}>
          Daily Goals ({stats.dailyGoals.completedGoals}/{stats.dailyGoals.totalGoals})
        </Text>
        <ProgressBar 
          progress={stats.dailyGoals.progressPercentage / 100}
          color="#2196F3"
        />
        <View style={styles.goalsList}>
          {stats.dailyGoals.goals.map(goal => (
            <View key={goal.type} style={styles.goalItem}>
              <Text>{goal.completed ? '✅' : '⭕'}</Text>
              <Text style={styles.goalName}>
                {formatGoalName(goal.type)}
              </Text>
            </View>
          ))}
        </View>
      </View>
      
      {/* Streak Display */}
      <View style={styles.streakSection}>
        <Text style={styles.streakText}>
          {stats.streakMessage}
        </Text>
        <Text style={styles.streakDays}>
          Current: {stats.currentStreak} days | Best: {stats.longestStreak} days
        </Text>
      </View>
    </View>
  );
};

const formatGoalName = (type) => {
  const names = {
    'daily_verse': 'Daily Verse',
    'daily_prayer': 'Daily Prayer',
    'daily_reflection': 'Daily Reflection',
    'ai_chat': 'AI Chat',
    'community_engagement': 'Community'
  };
  return names[type] || type;
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 8
  },
  levelSection: {
    marginBottom: 20
  },
  levelLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333'
  },
  xpText: {
    fontSize: 14,
    color: '#666',
    marginVertical: 8
  },
  goalsSection: {
    marginBottom: 20
  },
  goalsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8
  },
  goalsList: {
    marginTop: 12
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4
  },
  goalName: {
    marginLeft: 8,
    fontSize: 14
  },
  streakSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12
  },
  streakText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF5722'
  },
  streakDays: {
    fontSize: 12,
    color: '#666',
    marginTop: 4
  }
});

export default UserStatsCard;
```

---

## 🎨 Step 5: Add Level Up Animation

```javascript
// LevelUpModal.js
import React from 'react';
import { Modal, View, Text, StyleSheet, Animated } from 'react-native';

const LevelUpModal = ({ visible, level, onClose }) => {
  const scaleValue = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (visible) {
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true
      }).start();
      
      // Auto close after 3 seconds
      setTimeout(onClose, 3000);
    }
  }, [visible]);
  
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.container,
            { transform: [{ scale: scaleValue }] }
          ]}
        >
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>Level Up!</Text>
          <Text style={styles.level}>Level {level}</Text>
          <Text style={styles.subtitle}>Keep up the great work!</Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  container: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 280
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  level: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#4CAF50'
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8
  }
});

export default LevelUpModal;
```

---

## 🎖️ Activity Types Reference

Use these exact strings when tracking activities:

| Activity Type | XP | Use When |
|--------------|-----|----------|
| `daily_verse_read` | 10 | User finishes reading daily verse |
| `daily_verse_listened` | 15 | User finishes listening to daily verse |
| `daily_prayer_read` | 10 | User finishes reading daily prayer |
| `daily_prayer_listened` | 15 | User finishes listening to daily prayer |
| `daily_reflection_read` | 20 | User finishes reading daily reflection |
| `daily_reflection_listened` | 25 | User finishes listening to daily reflection |
| `ai_chat_message` | 5 | User sends a message in AI chat |
| `community_post` | 10 | User creates a community post |
| `community_comment` | 5 | User comments on a post |
| `study_group_attended` | 30 | User joins a study group session |
| `prayer_request_created` | 10 | User creates a prayer request |
| `prayer_response_given` | 15 | User responds to a prayer request |
| `bible_note_created` | 10 | User creates a Bible note |
| `verse_shared` | 5 | User shares a verse |

---

## ✅ Testing Checklist

- [ ] Track activities throughout app
- [ ] Send activities on app close/background
- [ ] Display user level and XP
- [ ] Show daily goals progress
- [ ] Animate level ups
- [ ] Handle offline scenarios
- [ ] Test XP calculations
- [ ] Verify daily goal tracking
- [ ] Test streak preservation

---

## 🐛 Troubleshooting

### Activities Not Tracking
```javascript
// Add console logging
activityTracker.track('daily_verse_read', 10);
console.log('Total activities:', activityTracker.getCount());
```

### XP Not Updating
```javascript
// Check response
const data = await trackSession(...);
console.log('Server response:', data);
```

### Daily Goals Not Showing
```javascript
// Verify goal mapping on backend
// Frontend just displays what backend sends
console.log('Daily goals:', stats.dailyGoals);
```

---

## 📖 Complete Example

```javascript
// CompleteIntegrationExample.js
import React, { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

const App = () => {
  const [userStats, setUserStats] = useState(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(0);
  const activityTracker = useRef(new ActivityTracker()).current;
  const sessionStart = useRef(new Date());
  
  // Load stats on mount
  useEffect(() => {
    loadUserStats();
  }, []);
  
  // Track app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);
  
  const loadUserStats = async () => {
    const response = await fetch('/api/users/app-session', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.success) {
      setUserStats(data.data);
    }
  };
  
  const handleAppStateChange = async (nextAppState) => {
    if (nextAppState === 'background') {
      await sendSession();
    } else if (nextAppState === 'active') {
      sessionStart.current = new Date();
    }
  };
  
  const sendSession = async () => {
    const now = new Date();
    const duration = Math.floor((now - sessionStart.current) / 1000);
    const activities = activityTracker.getAndClear();
    
    const response = await fetch('/api/users/app-session', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionStartTime: sessionStart.current.toISOString(),
        sessionEndTime: now.toISOString(),
        durationSeconds: duration,
        activities: activities
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Check for level up
      if (userStats && data.data.level > userStats.level) {
        setNewLevel(data.data.level);
        setShowLevelUp(true);
      }
      
      setUserStats(data.data);
    }
  };
  
  // Track activity example
  const handleVerseRead = () => {
    activityTracker.track('daily_verse_read', 10);
  };
  
  return (
    <View>
      <UserStatsCard stats={userStats} />
      <LevelUpModal 
        visible={showLevelUp}
        level={newLevel}
        onClose={() => setShowLevelUp(false)}
      />
      {/* Rest of your app */}
    </View>
  );
};
```

---

## 📚 Additional Resources

- `XP_GAMIFICATION_API.md` - Complete API documentation
- `XP_GAMIFICATION_SUMMARY.md` - Quick reference
- `XP_GAMIFICATION_COMPLETE.md` - Backend implementation details

---

## 🎉 You're Ready!

Follow this guide to integrate the XP system into your app. Start with activity tracking, then add the UI components.

**Questions?** Check the API documentation or console logs for debugging.

---

**Last Updated**: November 28, 2024

