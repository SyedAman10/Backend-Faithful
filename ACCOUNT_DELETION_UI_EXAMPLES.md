# Account Deletion - UI Implementation Examples

This document provides UI/UX examples for implementing the account deletion feature in your frontend.

---

## React Native Example (Settings Screen)

### Full Component Example

```javascript
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsScreen = ({ navigation }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = () => {
    // First confirmation
    Alert.alert(
      '⚠️ Delete Account',
      'Are you sure you want to permanently delete your account?\n\n' +
      'This will delete:\n' +
      '• All your prayer requests and notes\n' +
      '• Your study groups and memberships\n' +
      '• Your reading history and progress\n' +
      '• All your activity data\n\n' +
      'This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => showFinalConfirmation()
        }
      ]
    );
  };

  const showFinalConfirmation = () => {
    // Final confirmation with more emphasis
    Alert.alert(
      '⚠️ Final Confirmation',
      'Are you absolutely sure?\n\n' +
      'Your account and all data will be PERMANENTLY deleted. ' +
      'This action CANNOT be reversed.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => deleteAccount()
        }
      ]
    );
  };

  const deleteAccount = async () => {
    setIsDeleting(true);

    try {
      // Get auth token
      const token = await AsyncStorage.getItem('authToken');
      const apiUrl = await AsyncStorage.getItem('apiUrl') || 'https://your-api.com';

      if (!token) {
        throw new Error('Authentication required');
      }

      // Call deletion API
      const response = await fetch(`${apiUrl}/api/users/account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete account');
      }

      // Success - cleanup and logout
      await AsyncStorage.multiRemove([
        'authToken',
        'userData',
        'userPreferences'
      ]);

      // Show success message
      Alert.alert(
        'Account Deleted',
        'Your account has been permanently deleted.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to auth screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Auth' }]
              });
            }
          }
        ],
        { cancelable: false }
      );

    } catch (error) {
      console.error('Delete account error:', error);
      
      Alert.alert(
        'Error',
        error.message || 'Failed to delete account. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Other settings options here */}
      
      {/* Danger Zone Section */}
      <View style={styles.dangerZone}>
        <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
        
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteAccount}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.deleteButtonText}>Delete Account</Text>
              <Text style={styles.deleteButtonSubtext}>
                Permanently delete your account and all data
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20
  },
  dangerZone: {
    marginTop: 40,
    padding: 20,
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE',
  },
  dangerZoneTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C53030',
    marginBottom: 15
  },
  deleteButton: {
    backgroundColor: '#C53030',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center'
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  deleteButtonSubtext: {
    color: '#FFE5E5',
    fontSize: 12,
    textAlign: 'center'
  }
});

export default SettingsScreen;
```

---

## React Web Example (Settings Page)

### Full Component Example

```javascript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SettingsPage.css';

const SettingsPage = () => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const handleDeleteClick = () => {
    setShowModal(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);

    try {
      const token = localStorage.getItem('authToken');
      const apiUrl = process.env.REACT_APP_API_URL || 'https://your-api.com';

      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${apiUrl}/api/users/account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete account');
      }

      // Clear local storage
      localStorage.clear();

      // Show success and redirect
      alert('Your account has been permanently deleted.');
      navigate('/login');

    } catch (error) {
      console.error('Delete account error:', error);
      alert(error.message || 'Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowModal(false);
    }
  };

  return (
    <div className="settings-page">
      {/* Other settings sections */}

      {/* Danger Zone */}
      <div className="danger-zone">
        <h3 className="danger-zone-title">⚠️ Danger Zone</h3>
        
        <div className="danger-zone-content">
          <div>
            <h4>Delete Account</h4>
            <p>
              Permanently delete your account and all associated data.
              This action cannot be undone.
            </p>
          </div>
          
          <button
            className="delete-button"
            onClick={handleDeleteClick}
            disabled={isDeleting}
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>⚠️ Delete Account</h2>
            
            <div className="modal-body">
              <p>
                Are you absolutely sure you want to delete your account?
              </p>
              
              <div className="deletion-consequences">
                <p><strong>This will permanently delete:</strong></p>
                <ul>
                  <li>All your prayer requests and notes</li>
                  <li>Your study groups and memberships</li>
                  <li>Your reading history and progress</li>
                  <li>All your activity data</li>
                  <li>Your profile and preferences</li>
                </ul>
              </div>
              
              <p className="warning-text">
                <strong>This action cannot be undone!</strong>
              </p>
            </div>
            
            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => setShowModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              
              <button
                className="confirm-delete-button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
```

### CSS Styles

```css
/* SettingsPage.css */

.settings-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.danger-zone {
  margin-top: 40px;
  padding: 24px;
  background-color: #FFF5F5;
  border: 2px solid #FED7D7;
  border-radius: 12px;
}

.danger-zone-title {
  color: #C53030;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}

.danger-zone-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.danger-zone-content h4 {
  color: #1A202C;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.danger-zone-content p {
  color: #4A5568;
  font-size: 14px;
  line-height: 1.5;
}

.delete-button {
  background-color: #C53030;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
}

.delete-button:hover:not(:disabled) {
  background-color: #9B2C2C;
}

.delete-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 32px;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-content h2 {
  color: #C53030;
  font-size: 24px;
  margin-bottom: 20px;
}

.modal-body {
  margin-bottom: 24px;
  color: #2D3748;
}

.deletion-consequences {
  background-color: #FFF5F5;
  padding: 16px;
  border-radius: 8px;
  margin: 16px 0;
}

.deletion-consequences ul {
  margin: 12px 0;
  padding-left: 20px;
}

.deletion-consequences li {
  margin: 8px 0;
  color: #4A5568;
}

.warning-text {
  color: #C53030;
  font-weight: 600;
  margin-top: 16px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.cancel-button,
.confirm-delete-button {
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.cancel-button {
  background-color: #E2E8F0;
  color: #2D3748;
}

.cancel-button:hover:not(:disabled) {
  background-color: #CBD5E0;
}

.confirm-delete-button {
  background-color: #C53030;
  color: white;
}

.confirm-delete-button:hover:not(:disabled) {
  background-color: #9B2C2C;
}

.cancel-button:disabled,
.confirm-delete-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

---

## Best Practices

### 1. **Always Show Clear Warnings**
- Explain what will be deleted
- Emphasize that the action is permanent
- Use warning icons and colors

### 2. **Two-Step Confirmation**
- First alert: Explain consequences
- Second alert: Final confirmation
- Consider requiring text confirmation for web ("Type DELETE to confirm")

### 3. **Loading States**
- Show loading indicator during deletion
- Disable buttons during process
- Prevent duplicate requests

### 4. **Error Handling**
```javascript
try {
  // Delete account
} catch (error) {
  // Show user-friendly error message
  if (error.message.includes('Authentication')) {
    alert('Your session has expired. Please log in again.');
  } else if (error.message.includes('network')) {
    alert('Network error. Please check your connection and try again.');
  } else {
    alert('An error occurred. Please try again or contact support.');
  }
}
```

### 5. **Post-Deletion Cleanup**
```javascript
// Clear all local data
await AsyncStorage.multiRemove([
  'authToken',
  'userData',
  'userPreferences',
  'cachedData'
]);

// Or for web
localStorage.clear();
sessionStorage.clear();

// Clear any cached API requests
// Clear any stored images/files
// Reset any global state
```

### 6. **Navigation After Deletion**
```javascript
// React Native
navigation.reset({
  index: 0,
  routes: [{ name: 'Auth' }]
});

// React Router
navigate('/login', { replace: true });
```

---

## UI/UX Considerations

### Placement
- Put in Settings or Account section
- Place in a "Danger Zone" clearly separated from other options
- Use red/warning colors

### Visibility
- Don't hide too deep in settings
- Make it accessible but not too prominent
- Consider requiring authentication before showing

### Messaging
- Use clear, non-technical language
- List specific data that will be deleted
- Emphasize permanence
- Offer alternatives (e.g., "deactivate" vs "delete")

### Accessibility
- Use proper ARIA labels
- Ensure keyboard navigation works
- Test with screen readers
- Use sufficient color contrast

---

## Testing Checklist

- [ ] Button is visible in settings
- [ ] Click shows first confirmation
- [ ] Second confirmation appears after first
- [ ] Loading state shows during deletion
- [ ] Success redirects to login
- [ ] Local storage is cleared
- [ ] Error messages display correctly
- [ ] Works offline (shows appropriate error)
- [ ] Works with expired token (shows error)
- [ ] Can cancel at any step
- [ ] UI is accessible (screen readers)
- [ ] Works on all screen sizes

---

## Alternative Implementations

### Option 1: Text Confirmation (Web)
```javascript
const confirmText = prompt('Type "DELETE" to confirm account deletion:');
if (confirmText === 'DELETE') {
  // Proceed with deletion
}
```

### Option 2: Password Confirmation
```javascript
// Require user to enter password before deletion
const password = await promptForPassword();
const isValid = await verifyPassword(password);
if (isValid) {
  // Proceed with deletion
}
```

### Option 3: Email Confirmation
```javascript
// Send confirmation email with link
await sendDeletionConfirmationEmail();
alert('Check your email to confirm account deletion');
```

---

## Support & Documentation

For more information:
- **Backend Implementation:** See `ACCOUNT_DELETION_IMPLEMENTATION.md`
- **API Documentation:** See `ACCOUNT_DELETION_QUICK_START.md`
- **Testing:** See `test-account-deletion.js`
