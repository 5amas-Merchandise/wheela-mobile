import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import RNPickerSelect from 'react-native-picker-select';
import { Ionicons } from '@expo/vector-icons';

// Auth utility
import { getAuthToken } from '../../utils/auth';

// Backend URL
const baseUrl = 'https://wheels-backend.vercel.app'

// Cloudinary Config
const CLOUDINARY_CLOUD = 'ddlee3b3s';
const CLOUDINARY_PRESET = 'growvest';

const WHEELA_LOGO = require('../../../assets/logo.jpg');

const SERVICE_TYPES = [
  { label: 'City Ride (Car)', value: 'CITY_RIDE' },
  { label: 'Delivery (Bike)', value: 'DELIVERY_BIKE' },
  { label: 'Truck / Logistics', value: 'TRUCK' },
  { label: 'Interstate Travel', value: 'INTERSTATE' },
  { label: 'Keke / Tricycle', value: 'KEKE' },
  { label: 'Luxury Rental', value: 'LUXURY_RENTAL' },
];

export default function DriverProfileVerificationScreen({ navigation }) {
  const [token, setToken] = useState(null);
  const [form, setForm] = useState({
    name: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleNumber: '',
    nin: '',
    licenseNumber: '',
    serviceCategory: null,
  });

  const [uploadedUrls, setUploadedUrls] = useState({
    profilePic: null,
    vehiclePic: null,
    ninDoc: null,
    driversLicense: null,
    vehicleRegistration: null,
  });

  const [previews, setPreviews] = useState({});
  const [uploading, setUploading] = useState({});
  const [loading, setLoading] = useState(false);

  // Debug state
  const [debugInfo, setDebugInfo] = useState({
    lastPayload: null,
    lastResponse: null,
    lastError: null,
  });

  // Load authentication token
  useEffect(() => {
    const loadToken = async () => {
      try {
        const authToken = await getAuthToken();
        console.log('🔑 Auth token loaded:', authToken ? 'Yes' : 'No');
        if (authToken) {
          setToken(authToken);
        } else {
          Alert.alert('Session Expired', 'Please log in again.', [
            { text: 'OK', onPress: () => navigation.replace('Login') },
          ]);
        }
      } catch (error) {
        console.error('❌ Error loading token:', error);
        Alert.alert('Error', 'Failed to load authentication.');
      }
    };
    loadToken();
  }, [navigation]);

  const requestPermission = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return false;
      }
    }
    return true;
  };

  const uploadToCloudinary = async (file, field) => {
    console.log(`📤 Uploading ${field}:`, file.name || file.uri.substring(0, 50));
    setUploading(prev => ({ ...prev, [field]: true }));
    
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name || `${field}_${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
      formData.append('upload_preset', CLOUDINARY_PRESET);
      formData.append('cloud_name', CLOUDINARY_CLOUD);

      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
        formData,
        { 
          timeout: 30000,
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        }
      );

      const url = res.data.secure_url;
      console.log(`✅ Upload successful for ${field}:`, url.substring(0, 80) + '...');
      
      setUploadedUrls(prev => ({ ...prev, [field]: url }));
      
      Toast.show({
        type: 'success',
        text1: 'Uploaded ✓',
        text2: field.replace(/([A-Z])/g, ' $1').trim(),
      });
      
      return url;
    } catch (err) {
      console.error(`❌ Cloudinary upload error for ${field}:`, err.response?.data || err.message);
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: `Failed to upload ${field}. Please try again.`,
      });
      throw err;
    } finally {
      setUploading(prev => ({ ...prev, [field]: false }));
    }
  };

  const pickImage = async (field) => {
    console.log(`🖼️ Picking image for: ${field}`);
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (result.canceled || !result.assets?.[0]) {
        console.log('Image picker cancelled');
        return;
      }

      const asset = result.assets[0];
      console.log(`Selected asset for ${field}:`, {
        uri: asset.uri.substring(0, 50) + '...',
        width: asset.width,
        height: asset.height,
      });

      const file = {
        uri: asset.uri,
        name: asset.fileName || `${field}_${Date.now()}.jpg`,
      };

      setPreviews(prev => ({ ...prev, [field]: asset.uri }));
      const uploadedUrl = await uploadToCloudinary(file, field);
      return uploadedUrl;
    } catch (error) {
      console.error(`Error picking image for ${field}:`, error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to pick image. Please try again.',
      });
    }
  };

  const isFormComplete = () => {
    const complete = 
      form.name.trim() &&
      form.vehicleMake.trim() &&
      form.vehicleModel.trim() &&
      form.vehicleNumber.trim() &&
      /^[0-9]{11}$/.test(form.nin) &&
      form.licenseNumber.trim() &&
      form.serviceCategory &&
      uploadedUrls.profilePic &&
      uploadedUrls.vehiclePic &&
      uploadedUrls.ninDoc &&
      uploadedUrls.driversLicense &&
      uploadedUrls.vehicleRegistration;
    
    console.log('📋 Form completion check:', {
      name: !!form.name.trim(),
      vehicleMake: !!form.vehicleMake.trim(),
      vehicleModel: !!form.vehicleModel.trim(),
      vehicleNumber: !!form.vehicleNumber.trim(),
      nin: /^[0-9]{11}$/.test(form.nin),
      licenseNumber: !!form.licenseNumber.trim(),
      serviceCategory: !!form.serviceCategory,
      profilePic: !!uploadedUrls.profilePic,
      vehiclePic: !!uploadedUrls.vehiclePic,
      ninDoc: !!uploadedUrls.ninDoc,
      driversLicense: !!uploadedUrls.driversLicense,
      vehicleRegistration: !!uploadedUrls.vehicleRegistration,
      allComplete: complete,
    });
    
    return complete;
  };

  const validateForm = () => {
    const errors = [];
    
    if (!form.name.trim()) errors.push('Full name is required');
    if (!form.vehicleMake.trim()) errors.push('Vehicle make is required');
    if (!form.vehicleModel.trim()) errors.push('Vehicle model is required');
    if (!form.vehicleNumber.trim()) errors.push('Vehicle plate number is required');
    
    if (!/^[0-9]{11}$/.test(form.nin)) {
      errors.push('NIN must be exactly 11 digits');
    }
    
    if (!form.licenseNumber.trim()) errors.push('Driver\'s license number is required');
    if (!form.serviceCategory) errors.push('Service type is required');
    
    if (!uploadedUrls.profilePic) errors.push('Profile photo is required');
    if (!uploadedUrls.vehiclePic) errors.push('Vehicle photo is required');
    if (!uploadedUrls.ninDoc) errors.push('NIN document is required');
    if (!uploadedUrls.driversLicense) errors.push('Driver\'s license is required');
    if (!uploadedUrls.vehicleRegistration) errors.push('Vehicle registration is required');
    
    return errors;
  };

  const testAdminView = async () => {
    try {
      console.log('🔍 Testing admin view...');
      const response = await axios.get(`${baseUrl}/drivers/pending`);
      
      console.log('📊 Pending drivers response:', response.data);
      
      if (response.data.success) {
        Alert.alert(
          'Pending Drivers',
          `Found ${response.data.total || 0} pending drivers\n\n` +
          `First driver: ${response.data.drivers?.[0]?.name || 'None'}\n` +
          `Vehicle Make: ${response.data.drivers?.[0]?.vehicleMake || 'Not provided'}\n` +
          `Service: ${response.data.drivers?.[0]?.serviceCategories?.[0] || 'N/A'}`
        );
      } else {
        Alert.alert('Error', response.data.error?.message || 'Failed to fetch pending drivers');
      }
    } catch (error) {
      console.error('❌ Error testing admin view:', error.response?.data || error.message);
      Alert.alert(
        'Admin View Error',
        `Status: ${error.response?.status || 'No response'}\n` +
        `Message: ${error.response?.data?.error?.message || error.message}`
      );
    }
  };

  const checkUser = async (userId) => {
    if (!userId) return;
    
    try {
      console.log(`🔍 Checking user ${userId}...`);
      const response = await axios.get(`${baseUrl}/drivers/check-user/${userId}`);
      console.log('User check result:', response.data);
      
      if (response.data.success) {
        const user = response.data.user;
        Alert.alert(
          'User Check',
          `Name: ${user.name}\n` +
          `Has Driver Profile: ${user.hasDriverProfile ? 'Yes' : 'No'}\n` +
          `Profile Keys: ${user.driverProfileKeys?.join(', ') || 'None'}\n` +
          `Vehicle Make: ${user.driverProfile?.vehicleMake || 'Not saved'}\n` +
          `Service Categories: ${user.driverProfile?.serviceCategories?.join(', ') || 'None'}`
        );
      }
    } catch (error) {
      console.warn('Could not check user:', error.message);
    }
  };

  const handleSubmit = async () => {
    console.log('🚀 Starting submission process...');
    
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      Alert.alert(
        'Incomplete Form',
        `Please fix the following:\n\n• ${validationErrors.join('\n• ')}`,
        [{ text: 'OK' }]
      );
      return;
    }

    if (!token) {
      console.error('❌ No authentication token');
      Alert.alert('Error', 'Authentication required. Please log in again.');
      navigation.replace('Login');
      return;
    }

    // Ensure serviceCategory is always an array
    const serviceCategories = form.serviceCategory ? [form.serviceCategory] : [];
    
    const payload = {
      name: form.name.trim(),
      vehicleMake: form.vehicleMake.trim(),
      vehicleModel: form.vehicleModel.trim(),
      vehicleNumber: form.vehicleNumber.trim().toUpperCase(),
      nin: form.nin,
      licenseNumber: form.licenseNumber.trim(),
      serviceCategories: serviceCategories,
      profilePicUrl: uploadedUrls.profilePic,
      carPicUrl: uploadedUrls.vehiclePic,
      ninImageUrl: uploadedUrls.ninDoc,
      licenseImageUrl: uploadedUrls.driversLicense,
      vehicleRegistrationUrl: uploadedUrls.vehicleRegistration,
    };

    console.log('📦 Submission Payload:', JSON.stringify(payload, null, 2));
    setDebugInfo(prev => ({ ...prev, lastPayload: payload }));

    setLoading(true);
    
    try {
      console.log('📡 Sending request to:', `${baseUrl}/drivers/request-verification`);
      
      const response = await axios.put(
        `${baseUrl}/drivers/request-verification`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          timeout: 60000,
        }
      );

      console.log('✅ Server Response:', JSON.stringify(response.data, null, 2));
      setDebugInfo(prev => ({ ...prev, lastResponse: response.data }));

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Submission failed');
      }

      Toast.show({
        type: 'success',
        text1: 'Submitted Successfully!',
        text2: 'Your profile has been updated.',
        visibilityTime: 4000,
      });

      // Check if driverProfile was saved
      const hasDriverProfile = response.data.debug?.hasDriverProfile;
      const profileKeys = response.data.debug?.profileKeys || [];
      const vehicleMake = response.data.debug?.vehicleMake;
      
      // Immediately check pending drivers
      setTimeout(async () => {
        try {
          console.log('🔄 Checking pending drivers list...');
          const pendingResponse = await axios.get(`${baseUrl}/drivers/pending`);
          console.log('📊 Pending drivers after submission:', pendingResponse.data);
          
          if (pendingResponse.data.success) {
            const currentUserInList = pendingResponse.data.drivers?.some(
              driver => driver.name === form.name.trim()
            );
            
            if (currentUserInList) {
              console.log('✅ User found in pending list!');
            } else {
              console.log('⚠️ User NOT found in pending list');
            }
          }
        } catch (checkErr) {
          console.warn('Could not check pending drivers:', checkErr.message);
        }
      }, 1000);

      // Also check the specific user
      if (response.data.data?.userId) {
        setTimeout(() => {
          checkUser(response.data.data.userId);
        }, 1500);
      }

      const alertButtons = [
        { 
          text: 'OK', 
          onPress: () => {
            // Clear form after successful submission
            setForm({
              name: '',
              vehicleMake: '',
              vehicleModel: '',
              vehicleNumber: '',
              nin: '',
              licenseNumber: '',
              serviceCategory: null,
            });
            setUploadedUrls({
              profilePic: null,
              vehiclePic: null,
              ninDoc: null,
              driversLicense: null,
              vehicleRegistration: null,
            });
            setPreviews({});
            navigation.replace('DriverHomeOffline');
          }
        }
      ];

      // Add debug button if we have debug info
      if (response.data.debug) {
        alertButtons.push({
          text: 'Debug Info',
          onPress: () => {
            Alert.alert(
              'Debug Information',
              `Status: Success\n` +
              `Message: ${response.data.message}\n\n` +
              `Driver Profile Saved: ${hasDriverProfile ? '✅ Yes' : '❌ No'}\n` +
              `Profile Keys: ${profileKeys.length > 0 ? profileKeys.join(', ') : 'None'}\n` +
              `Vehicle Make: ${vehicleMake || 'Not saved'}\n\n` +
              `Verification State: ${response.data.data?.verificationState || 'pending'}\n` +
              `Submitted At: ${new Date(response.data.data?.submittedAt || Date.now()).toLocaleString()}`
            );
          }
        });
      }

      Alert.alert(
        'Success ✓',
        'Documents submitted successfully!\n\n' +
        'Review takes 24-48 hours.\n\n' +
        `Status: ${response.data.data?.verificationState || 'pending'}\n` +
        `Driver Profile: ${hasDriverProfile ? 'Saved ✓' : 'Not saved'}`,
        alertButtons
      );
    } catch (err) {
      console.error('❌ Submission Error:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        config: {
          url: err.config?.url,
          data: err.config?.data,
        },
        stack: err.stack,
      });
      
      setDebugInfo(prev => ({ ...prev, lastError: err }));

      let message = 'Submission failed. Please try again.';
      let details = '';
      
      if (err.response) {
        const errorData = err.response.data;
        
        if (errorData.error?.message) {
          message = errorData.error.message;
        } else if (errorData.message) {
          message = errorData.message;
        } else {
          message = `Server error: ${err.response.status}`;
        }
        
        if (errorData.error?.details) {
          if (Array.isArray(errorData.error.details)) {
            details = errorData.error.details.join('\n');
          } else {
            details = errorData.error.details;
          }
        }
      } else if (err.request) {
        message = 'No response from server. Check your connection and server status.';
      } else if (err.message.includes('timeout')) {
        message = 'Request timeout. Server is taking too long to respond.';
      }

      const alertButtons = [{ text: 'OK' }];
      
      if (err.response?.data) {
        alertButtons.push({
          text: 'View Error Details',
          onPress: () => {
            Alert.alert(
              'Error Details',
              `Message: ${message}\n\n` +
              (details ? `Details: ${details}\n\n` : '') +
              `Status: ${err.response?.status || 'N/A'}\n` +
              `Full Response: ${JSON.stringify(err.response?.data || {}, null, 2)}`
            );
          }
        });
      }

      Alert.alert('Submission Failed', message, alertButtons);
    } finally {
      setLoading(false);
    }
  };

  const UploadBox = ({ title, field }) => (
    <View style={styles.uploadSection}>
      <Text style={styles.uploadLabel}>
        {title} * {uploadedUrls[field] ? '✓' : ''}
      </Text>
      <TouchableOpacity
        style={[
          styles.uploadBox,
          uploadedUrls[field] && styles.uploadBoxSuccess,
        ]}
        onPress={() => pickImage(field)}
        disabled={uploading[field]}
      >
        {previews[field] ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: previews[field] }} style={styles.previewImage} />
            {uploading[field] && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color="#00B0F3" />
                <Text style={styles.uploadingText}>Uploading...</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.uploadPlaceholderContainer}>
            <Ionicons 
              name={uploading[field] ? "cloud-upload" : "cloud-upload-outline"} 
              size={48} 
              color={uploading[field] ? "#00B0F3" : "#FFFFFFAA"} 
            />
            <Text style={styles.uploadPlaceholder}>
              {uploading[field] ? 'Uploading...' : 'Tap to upload'}
            </Text>
          </View>
        )}
        
        {uploadedUrls[field] && !uploading[field] && (
          <View style={styles.successBadge}>
            <Text style={styles.successBadgeText}>✓ Uploaded</Text>
          </View>
        )}
      </TouchableOpacity>
      
      {uploadedUrls[field] && (
        <Text style={styles.urlPreview} numberOfLines={1}>
          URL: {uploadedUrls[field].substring(0, 60)}...
        </Text>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Image source={WHEELA_LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>Submit documents for driver verification</Text>
        
        <View style={styles.debugButtonsContainer}>
          <TouchableOpacity 
            style={styles.debugButton}
            onPress={testAdminView}
          >
            <Text style={styles.debugButtonText}>🔍 Test Admin View</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.debugButton}
            onPress={() => {
              Alert.alert(
                'Debug Information',
                `Token: ${token ? '✅ Present' : '❌ Missing'}\n\n` +
                `Form Complete: ${isFormComplete() ? '✅ Yes' : '❌ No'}\n\n` +
                `Last Payload: ${debugInfo.lastPayload ? JSON.stringify(debugInfo.lastPayload, null, 2) : 'None'}\n\n` +
                `Last Response: ${debugInfo.lastResponse ? JSON.stringify(debugInfo.lastResponse, null, 2) : 'None'}\n\n` +
                `Last Error: ${debugInfo.lastError ? debugInfo.lastError.message : 'None'}`
              );
            }}
          >
            <Text style={styles.debugButtonText}>🛠️ Debug Info</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TextInput 
        style={styles.input} 
        placeholder="Full Name *" 
        value={form.name} 
        onChangeText={v => setForm(p => ({ ...p, name: v }))} 
        placeholderTextColor="#FFFFFF88"
      />
      
      <TextInput 
        style={styles.input} 
        placeholder="Vehicle Make (e.g. Toyota) *" 
        value={form.vehicleMake} 
        onChangeText={v => setForm(p => ({ ...p, vehicleMake: v }))} 
        placeholderTextColor="#FFFFFF88"
      />
      
      <TextInput 
        style={styles.input} 
        placeholder="Vehicle Model & Year (e.g. Camry 2018) *" 
        value={form.vehicleModel} 
        onChangeText={v => setForm(p => ({ ...p, vehicleModel: v }))} 
        placeholderTextColor="#FFFFFF88"
      />
      
      <TextInput 
        style={styles.input} 
        placeholder="Vehicle Plate Number *" 
        value={form.vehicleNumber} 
        onChangeText={v => setForm(p => ({ ...p, vehicleNumber: v }))} 
        autoCapitalize="characters"
        placeholderTextColor="#FFFFFF88"
      />
      
      <TextInput 
        style={styles.input} 
        placeholder="NIN (11 digits) *" 
        value={form.nin} 
        onChangeText={v => setForm(p => ({ ...p, nin: v.replace(/\D/g, '').slice(0, 11) }))} 
        keyboardType="numeric" 
        maxLength={11}
        placeholderTextColor="#FFFFFF88"
      />
      
      <TextInput 
        style={styles.input} 
        placeholder="Driver's License Number *" 
        value={form.licenseNumber} 
        onChangeText={v => setForm(p => ({ ...p, licenseNumber: v }))} 
        placeholderTextColor="#FFFFFF88"
      />

      {/* Service Type Dropdown */}
      <View style={styles.section}>
        <Text style={styles.uploadLabel}>
          Service Type * {form.serviceCategory ? '✓' : ''}
        </Text>
        <View style={styles.pickerContainer}>
          <RNPickerSelect
            onValueChange={(value) => {
              console.log('Service category selected:', value);
              setForm(p => ({ ...p, serviceCategory: value }));
            }}
            items={SERVICE_TYPES}
            value={form.serviceCategory}
            placeholder={{ 
              label: 'Select your service type... *', 
              value: null,
              color: '#AAAAAA',
            }}
            useNativeAndroidPickerStyle={false}
            style={pickerSelectStyles}
            Icon={() => <Ionicons name="chevron-down" size={24} color="#AAAAAA" />}
          />
        </View>
        {form.serviceCategory && (
          <Text style={styles.selectedService}>
            Selected: {SERVICE_TYPES.find(s => s.value === form.serviceCategory)?.label}
          </Text>
        )}
      </View>

      {/* Image Uploads */}
      <UploadBox title="Profile Photo (Clear Face)" field="profilePic" />
      <UploadBox title="Vehicle Photo (Full View)" field="vehiclePic" />
      <UploadBox title="NIN Document" field="ninDoc" />
      <UploadBox title="Driver's License" field="driversLicense" />
      <UploadBox title="Vehicle Registration" field="vehicleRegistration" />

      {/* Form Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>Form Status:</Text>
        <Text style={[
          styles.statusText,
          isFormComplete() ? styles.statusComplete : styles.statusIncomplete
        ]}>
          {isFormComplete() ? '✅ Ready to Submit' : '❌ Incomplete'}
        </Text>
        <Text style={styles.statusDetails}>
          {Object.values(uploadedUrls).filter(url => url).length}/5 documents uploaded
        </Text>
        <Text style={styles.statusDetails}>
          {form.name ? `Name: ${form.name}` : 'Name not provided'}
        </Text>
        {form.serviceCategory && (
          <Text style={styles.statusDetails}>
            Service: {SERVICE_TYPES.find(s => s.value === form.serviceCategory)?.label}
          </Text>
        )}
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitBtn, 
          (!isFormComplete() || loading) && styles.submitDisabled
        ]}
        onPress={handleSubmit}
        disabled={!isFormComplete() || loading}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#010C44" size="small" />
            <Text style={styles.submitText}>Submitting...</Text>
          </View>
        ) : (
          <Text style={styles.submitText}>Submit for Verification</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.note}>
        ⏰ Review usually takes 24-48 hours. You'll be notified once approved.
      </Text>
      <Text style={styles.note}>
        📱 Ensure all documents are clear and readable.
      </Text>
      <Text style={styles.note}>
        🔍 Use debug buttons above to check submission status.
      </Text>

      <Toast />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#010C44' 
  },
  content: { 
    paddingHorizontal: 24, 
    paddingTop: 40, 
    paddingBottom: 40 
  },
  header: { 
    alignItems: 'center', 
    marginBottom: 30 
  },
  logo: { 
    width: 100, 
    height: 100, 
    marginBottom: 16 
  },
  title: { 
    color: '#FFFFFF', 
    fontSize: 28, 
    fontWeight: '700', 
    textAlign: 'center' 
  },
  subtitle: { 
    color: '#FFFFFFAA', 
    fontSize: 16, 
    textAlign: 'center', 
    marginTop: 8,
    marginBottom: 20,
  },
  debugButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
  debugButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  debugButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  input: {
    backgroundColor: '#1A1F5A',
    color: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2F7A',
  },
  section: { 
    marginBottom: 24 
  },
  uploadLabel: { 
    color: '#00B0F3', 
    fontSize: 16, 
    fontWeight: '600', 
    marginBottom: 12 
  },
  selectedService: {
    color: '#00FF88',
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
  },
  pickerContainer: { 
    backgroundColor: '#1A1F5A', 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2F7A',
  },
  uploadSection: { 
    marginBottom: 24 
  },
  uploadBox: {
    backgroundColor: '#1A1F5A',
    borderRadius: 12,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2A2F7A',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  uploadBoxSuccess: {
    borderColor: '#00FF88',
    borderStyle: 'solid',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  previewImage: { 
    width: '100%', 
    height: '100%', 
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 14,
  },
  uploadPlaceholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPlaceholder: { 
    color: '#FFFFFFAA', 
    fontSize: 16,
    marginTop: 12,
  },
  successBadge: { 
    position: 'absolute', 
    top: 12, 
    right: 12, 
    backgroundColor: 'rgba(0, 176, 243, 0.9)', 
    paddingHorizontal: 12,
    paddingVertical: 6, 
    borderRadius: 20,
  },
  successBadgeText: { 
    color: '#FFFFFF', 
    fontWeight: 'bold',
    fontSize: 12,
  },
  urlPreview: {
    color: '#AAAAAA',
    fontSize: 10,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginVertical: 20,
    alignItems: 'center',
  },
  statusTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusComplete: {
    color: '#00FF88',
  },
  statusIncomplete: {
    color: '#FF6B6B',
  },
  statusDetails: {
    color: '#FFFFFFAA',
    fontSize: 14,
    marginBottom: 4,
  },
  submitBtn: {
    backgroundColor: '#00B0F3',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 20,
    shadowColor: '#00B0F3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  submitDisabled: { 
    opacity: 0.5 
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { 
    color: '#010C44', 
    fontSize: 18, 
    fontWeight: '800',
    marginLeft: 8,
  },
  note: { 
    color: '#FFFFFFAA', 
    fontSize: 14, 
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
});

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingRight: 40,
    fontSize: 16,
    color: '#FFFFFF',
  },
  inputAndroid: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingRight: 40,
    fontSize: 16,
    color: '#FFFFFF',
    backgroundColor: '#1A1F5A',
  },
  placeholder: { 
    color: '#AAAAAA' 
  },
  iconContainer: {
    top: '50%',
    right: 12,
    marginTop: -12,
  },
});