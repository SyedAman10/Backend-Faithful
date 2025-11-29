# 📸 Profile Picture API Documentation

## Overview
Complete profile picture management system that supports both Google profile pictures and custom user uploads.

---

## 🎯 Features

1. **Automatic Google Picture** - Automatically uses Google profile picture if user signs up with Google
2. **Custom Upload** - Users can upload custom profile pictures (base64 or URL)
3. **Priority System** - Custom picture takes priority over Google picture
4. **Revert to Google** - Users can revert back to their Google profile picture
5. **Delete Custom** - Remove custom picture and fallback to Google picture
6. **Flexible Format** - Supports base64 images and URLs

---

## 📊 Database Schema

### User Picture Columns

| Column | Type | Description |
|--------|------|-------------|
| `picture` | VARCHAR | Legacy column (backward compatibility) |
| `google_picture` | TEXT | Original Google profile picture URL |
| `custom_picture` | TEXT | User-uploaded custom picture (base64/URL) |

### Picture Priority
1. **custom_picture** - Used if available (user uploaded)
2. **google_picture** - Used if no custom picture (from Google OAuth)
3. **picture** - Legacy fallback

---

## 📡 API Endpoints

### 1. GET /api/users/profile
Get user profile with appropriate profile picture.

**Requires Authentication**: Yes (JWT Bearer token)

#### Request
```http
GET /api/users/profile
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Response
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "picture": "data:image/png;base64,...",  // Custom or Google picture
    "hasCustomPicture": true,
    "hasGooglePicture": true,
    "denomination": "Catholic",
    "bible_version": "KJV",
    ...
  }
}
```

---

### 2. POST /api/users/profile/picture
Upload or update custom profile picture.

**Requires Authentication**: Yes (JWT Bearer token)

#### Request - Upload Custom Picture
```http
POST /api/users/profile/picture
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "picture": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."
}
```

#### Request - Revert to Google Picture
```http
POST /api/users/profile/picture
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "useGooglePicture": true
}
```

#### Response - Upload Success
```json
{
  "success": true,
  "message": "Profile picture updated successfully",
  "picture": "data:image/png;base64,...",
  "hasCustomPicture": true,
  "hasGooglePicture": true
}
```

#### Response - Revert Success
```json
{
  "success": true,
  "message": "Reverted to Google profile picture",
  "picture": "https://lh3.googleusercontent.com/..."
}
```

---

### 3. DELETE /api/users/profile/picture
Remove custom profile picture and revert to Google picture.

**Requires Authentication**: Yes (JWT Bearer token)

#### Request
```http
DELETE /api/users/profile/picture
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Response
```json
{
  "success": true,
  "message": "Custom profile picture removed",
  "picture": "https://lh3.googleusercontent.com/...",
  "hasCustomPicture": false,
  "hasGooglePicture": true
}
```

---

### 4. PUT /api/users/profile
Update user profile (including custom picture).

**Requires Authentication**: Yes (JWT Bearer token)

#### Request
```http
PUT /api/users/profile
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "John Doe",
  "customPicture": "data:image/jpeg;base64,...",
  "denomination": "Catholic",
  "bibleVersion": "NIV"
}
```

---

## 📱 Frontend Integration

### React Native Example with Image Picker

```javascript
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

// 1. Pick image from gallery
const pickImage = async () => {
  // Request permission
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
  if (status !== 'granted') {
    alert('Permission to access gallery is required!');
    return;
  }

  // Pick image
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1], // Square crop
    quality: 0.8, // Compress to reduce size
  });

  if (!result.canceled) {
    await uploadProfilePicture(result.assets[0].uri);
  }
};

// 2. Convert to base64 and upload
const uploadProfilePicture = async (imageUri) => {
  try {
    // Convert to base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Determine image type
    const imageType = imageUri.split('.').pop();
    const mimeType = imageType === 'png' ? 'image/png' : 'image/jpeg';
    
    // Create data URI
    const dataUri = `data:${mimeType};base64,${base64}`;
    
    // Upload to server
    const response = await fetch('/api/users/profile/picture', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        picture: dataUri
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Picture uploaded!', data.picture);
      // Update UI with new picture
      updateUserPicture(data.picture);
    } else {
      console.error('Upload failed:', data.error);
    }
  } catch (error) {
    console.error('Upload error:', error);
  }
};

// 3. Revert to Google picture
const revertToGooglePicture = async () => {
  try {
    const response = await fetch('/api/users/profile/picture', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        useGooglePicture: true
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Reverted to Google picture');
      updateUserPicture(data.picture);
    }
  } catch (error) {
    console.error('Revert error:', error);
  }
};

// 4. Delete custom picture
const deleteCustomPicture = async () => {
  try {
    const response = await fetch('/api/users/profile/picture', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Custom picture deleted');
      updateUserPicture(data.picture);
    }
  } catch (error) {
    console.error('Delete error:', error);
  }
};

// 5. Display profile picture
const ProfilePicture = ({ picture, hasCustomPicture, hasGooglePicture }) => {
  return (
    <View style={styles.container}>
      <Image 
        source={{ uri: picture }}
        style={styles.profileImage}
      />
      
      <View style={styles.actions}>
        <TouchableOpacity onPress={pickImage}>
          <Text>Upload New Picture</Text>
        </TouchableOpacity>
        
        {hasCustomPicture && hasGooglePicture && (
          <TouchableOpacity onPress={revertToGooglePicture}>
            <Text>Use Google Picture</Text>
          </TouchableOpacity>
        )}
        
        {hasCustomPicture && (
          <TouchableOpacity onPress={deleteCustomPicture}>
            <Text>Remove Custom Picture</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 20
  },
  actions: {
    gap: 10
  }
});
```

---

## 🔒 Validation Rules

### Image Size
- **Maximum**: 5MB
- **Format**: JPEG, PNG, GIF, WebP
- **Encoding**: Base64 or URL

### Supported Formats
- **Base64**: `data:image/png;base64,iVBORw0KGgo...`
- **URL**: `https://example.com/image.jpg`

### Validation Example
```javascript
const validateImage = (base64String) => {
  // Check format
  if (!base64String.startsWith('data:image/')) {
    throw new Error('Invalid image format');
  }
  
  // Check size
  const base64Length = base64String.length - (base64String.indexOf(',') + 1);
  const sizeInBytes = (base64Length * 3) / 4;
  const sizeInMB = sizeInBytes / (1024 * 1024);
  
  if (sizeInMB > 5) {
    throw new Error(`Image too large: ${sizeInMB.toFixed(2)}MB (max 5MB)`);
  }
  
  return true;
};
```

---

## ⚠️ Error Responses

### 400 Bad Request - No Picture Data
```json
{
  "success": false,
  "error": "Picture data is required"
}
```

### 400 Bad Request - Invalid Format
```json
{
  "success": false,
  "error": "Picture must be a valid base64 image or URL"
}
```

### 400 Bad Request - Image Too Large
```json
{
  "success": false,
  "error": "Image size must be less than 5MB",
  "actualSize": "6.43MB"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "No token provided"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "User not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to upload profile picture",
  "message": "Database connection error"
}
```

---

## 🎨 Best Practices

### 1. Image Optimization
```javascript
// Compress image before upload
const compressImage = async (uri) => {
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }], // Resize to max width
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return manipResult.uri;
};
```

### 2. Show Loading State
```javascript
const [uploading, setUploading] = useState(false);

const uploadPicture = async (uri) => {
  setUploading(true);
  try {
    await uploadProfilePicture(uri);
  } finally {
    setUploading(false);
  }
};
```

### 3. Handle Errors Gracefully
```javascript
const uploadWithErrorHandling = async (uri) => {
  try {
    await uploadProfilePicture(uri);
    Alert.alert('Success', 'Profile picture updated!');
  } catch (error) {
    if (error.message.includes('5MB')) {
      Alert.alert('Image Too Large', 'Please select a smaller image');
    } else {
      Alert.alert('Upload Failed', 'Please try again');
    }
  }
};
```

### 4. Cache Profile Pictures
```javascript
import { Image } from 'react-native';

// Enable caching
<Image 
  source={{ uri: profilePicture, cache: 'force-cache' }}
  style={styles.avatar}
/>
```

---

## 🔧 Migration

Run the migration to add profile picture columns:

```bash
node scripts/run-profile-picture-migration.js
```

**Migration includes:**
- Adds `google_picture` column
- Adds `custom_picture` column
- Creates indexes for performance
- Migrates existing Google pictures
- Preserves backward compatibility

---

## 📊 Usage Statistics

After migration, you'll see:
- Total users
- Users with pictures
- Users with Google pictures
- Users with custom pictures

---

## 🔮 Future Enhancements

- Image CDN integration (Cloudinary, S3)
- Automatic image optimization on backend
- Multiple profile picture sizes (thumbnail, medium, large)
- Profile picture history
- AI-powered profile picture suggestions

---

## 📝 Console Logging

All endpoints include detailed logging:

```
📸 Upload Profile Picture Request: { userId, email, timestamp }
📊 Image size: { userId, sizeInMB, format }
🖼️ Updating custom picture: { userId, hasCustomPicture, isBase64 }
✅ Profile picture uploaded successfully: { userId, hasCustomPicture }
```

---

## 🎯 Summary

| Feature | Endpoint | Method |
|---------|----------|--------|
| Get profile | `/api/users/profile` | GET |
| Upload picture | `/api/users/profile/picture` | POST |
| Revert to Google | `/api/users/profile/picture` (body: `{useGooglePicture: true}`) | POST |
| Delete custom | `/api/users/profile/picture` | DELETE |

**Priority**: Custom Picture > Google Picture > Legacy Picture

---

**Last Updated**: November 28, 2024


