// Utility functions for recurring meetings

// Convert day names to numbers (0 = Sunday, 1 = Monday, etc.)
const DAY_NAMES_TO_NUMBERS = {
  'sunday': 0,
  'monday': 1,
  'tuesday': 2,
  'wednesday': 3,
  'thursday': 4,
  'friday': 5,
  'saturday': 6
};

// Convert day numbers to names
const DAY_NUMBERS_TO_NAMES = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday'
};

// Generate recurrence rule for Google Calendar
const generateRecurrenceRule = (pattern, interval = 1, daysOfWeek = [], endDate = null) => {
  let rule = `RRULE:FREQ=${pattern.toUpperCase()}`;
  
  if (interval > 1) {
    rule += `;INTERVAL=${interval}`;
  }
  
  if (daysOfWeek && daysOfWeek.length > 0) {
    const dayNames = daysOfWeek.map(day => {
      const dayName = DAY_NUMBERS_TO_NAMES[day];
      return dayName.substring(0, 2).toUpperCase();
    });
    rule += `;BYDAY=${dayNames.join(',')}`;
  }
  
  if (endDate) {
    // Ensure endDate is a Date object
    const endDateObj = endDate instanceof Date ? endDate : new Date(endDate);
    if (!isNaN(endDateObj.getTime())) {
      rule += `;UNTIL=${endDateObj.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
    }
  }
  
  return rule;
};

// Calculate next occurrence based on recurrence pattern
const calculateNextOccurrence = (startTime, pattern, interval = 1, daysOfWeek = []) => {
  const startDate = new Date(startTime);
  const now = new Date();
  
  if (startDate <= now) {
    // Start time is in the past, calculate next occurrence
    let nextDate = new Date(startDate);
    
    switch (pattern.toLowerCase()) {
      case 'daily':
        while (nextDate <= now) {
          nextDate.setDate(nextDate.getDate() + interval);
        }
        break;
        
      case 'weekly':
        if (daysOfWeek && daysOfWeek.length > 0) {
          // Find next occurrence on specified days
          let found = false;
          let currentDate = new Date(now);
          currentDate.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);
          
          // Look ahead up to 8 weeks to find next occurrence
          for (let week = 0; week < 8; week++) {
            for (const dayOfWeek of daysOfWeek) {
              const targetDate = new Date(currentDate);
              const daysToAdd = (dayOfWeek - currentDate.getDay() + 7) % 7;
              targetDate.setDate(targetDate.getDate() + daysToAdd + (week * 7));
              
              if (targetDate > now) {
                nextDate = targetDate;
                found = true;
                break;
              }
            }
            if (found) break;
          }
        } else {
          // Every week on the same day
          while (nextDate <= now) {
            nextDate.setDate(nextDate.getDate() + (7 * interval));
          }
        }
        break;
        
      case 'monthly':
        while (nextDate <= now) {
          nextDate.setMonth(nextDate.getMonth() + interval);
        }
        break;
        
      default:
        return null;
    }
    
    return nextDate;
  }
  
  return startDate;
};

// Generate all occurrences for a given period
const generateOccurrences = (startTime, endTime, pattern, interval = 1, daysOfWeek = [], maxOccurrences = 52) => {
  const occurrences = [];
  let currentDate = new Date(startTime);
  let count = 0;
  
  while (currentDate <= endTime && count < maxOccurrences) {
    occurrences.push(new Date(currentDate));
    count++;
    
    switch (pattern.toLowerCase()) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + interval);
        break;
        
      case 'weekly':
        if (daysOfWeek && daysOfWeek.length > 0) {
          // Find next occurrence on specified days
          let found = false;
          for (let week = 1; week <= 8; week++) {
            for (const dayOfWeek of daysOfWeek) {
              const nextDate = new Date(currentDate);
              const daysToAdd = (dayOfWeek - currentDate.getDay() + 7) % 7;
              nextDate.setDate(nextDate.getDate() + daysToAdd + (week * 7));
              
              if (nextDate > currentDate) {
                currentDate = nextDate;
                found = true;
                break;
              }
            }
            if (found) break;
          }
        } else {
          currentDate.setDate(currentDate.getDate() + (7 * interval));
        }
        break;
        
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + interval);
        break;
        
      default:
        return occurrences;
    }
  }
  
  return occurrences;
};

// Validate recurrence parameters
const validateRecurrenceParams = (pattern, interval, daysOfWeek, endDate) => {
  const errors = [];
  
  if (!['daily', 'weekly', 'monthly'].includes(pattern.toLowerCase())) {
    errors.push('Invalid recurrence pattern. Must be daily, weekly, or monthly.');
  }
  
  if (interval < 1 || interval > 99) {
    errors.push('Invalid interval. Must be between 1 and 99.');
  }
  
  if (pattern.toLowerCase() === 'weekly' && daysOfWeek) {
    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      errors.push('Weekly recurrence requires at least one day of the week.');
    }
    
    for (const day of daysOfWeek) {
      if (day < 0 || day > 6) {
        errors.push('Invalid day of week. Must be 0-6 (Sunday-Saturday).');
      }
    }
  }
  
  if (endDate && new Date(endDate) <= new Date()) {
    errors.push('End date must be in the future.');
  }
  
  return errors;
};

// Format recurrence description for display
const formatRecurrenceDescription = (pattern, interval, daysOfWeek, endDate) => {
  let description = `Every ${interval > 1 ? interval + ' ' : ''}`;
  
  switch (pattern.toLowerCase()) {
    case 'daily':
      description += interval === 1 ? 'day' : 'days';
      break;
      
    case 'weekly':
      if (daysOfWeek && daysOfWeek.length > 0) {
        const dayNames = daysOfWeek.map(day => DAY_NUMBERS_TO_NAMES[day]);
        if (dayNames.length === 1) {
          description += dayNames[0];
        } else if (dayNames.length === 2) {
          description += dayNames.join(' and ');
        } else {
          description += dayNames.slice(0, -1).join(', ') + ' and ' + dayNames[dayNames.length - 1];
        }
      } else {
        description += interval === 1 ? 'week' : 'weeks';
      }
      break;
      
    case 'monthly':
      description += interval === 1 ? 'month' : 'months';
      break;
  }
  
  if (endDate) {
    description += ` until ${new Date(endDate).toLocaleDateString()}`;
  }
  
  return description;
};

module.exports = {
  DAY_NAMES_TO_NUMBERS,
  DAY_NUMBERS_TO_NAMES,
  generateRecurrenceRule,
  calculateNextOccurrence,
  generateOccurrences,
  validateRecurrenceParams,
  formatRecurrenceDescription
};
