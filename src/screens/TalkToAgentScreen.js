import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';

const TalkToAgentScreen = ({ route, navigation }) => {
  const canGoBack = navigation.canGoBack();
  const { token, user } = useAuth();
  const { itinerary, destination, people, adults, children, customization, cartItems } = route.params || {};
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [preferredContact, setPreferredContact] = useState('phone');
  const [submitting, setSubmitting] = useState(false);

  const contactMethods = [
    { id: 'phone', name: 'Phone Call', icon: 'call-outline' },
    { id: 'whatsapp', name: 'WhatsApp', icon: 'chatbubble-ellipses-outline' },
    { id: 'email', name: 'Email', icon: 'mail-outline' },
  ];

  const handleSubmit = async () => {
    if (!name || !phone || !email) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    if (!token) {
      Alert.alert('Error', 'Please login again before sending a request.');
      return;
    }

    setSubmitting(true);
    try {
      const summaryParts = [
        destination ? `Destination: ${destination}` : null,
        people ? `People: ${people}` : null,
        adults ? `Adults: ${adults}` : null,
        children != null ? `Children: ${children}` : null,
        itinerary?.title ? `Itinerary: ${itinerary.title}` : null,
        preferredContact ? `Preferred contact: ${preferredContact}` : null,
      ].filter(Boolean);

      const initialMessage = [
        `Customer details`,
        `Name: ${name}`,
        `Phone: ${phone}`,
        `Email: ${email}`,
        message ? `Message: ${message}` : null,
        summaryParts.length ? `Trip Summary: ${summaryParts.join(' | ')}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await fetch(`${API_CONFIG.BASE_URL}/messages/conversations/customer/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itineraryId: itinerary?.id || null,
          destination: destination || null,
          numberOfPeople: people ? Number(people) : null,
          budget: itinerary?.price ? String(itinerary.price) : null,
          summary: summaryParts.join(' | '),
          initialMessage,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to start chat');
      }

      Alert.alert('Chat Started', 'Your request reached our travel agent. Continue in chat.', [
        {
          text: 'Open Chat',
          onPress: () => navigation.replace('ChatScreen', { conversation: data }),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        {canGoBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 30 }} />
        )}
        <Text style={styles.headerTitle}>Talk to Agent</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Agent Info */}
        <View style={styles.agentSection}>
          <View style={styles.agentCard}>
            <Ionicons name="person-circle-outline" size={56} color={Colors.primary} style={styles.agentAvatar} />
            <View style={styles.agentInfo}>
              <Text style={styles.agentName}>Travel Expert</Text>
              <Text style={styles.agentStatus}>Available 24/7</Text>
            </View>
            <View style={styles.onlineIndicator} />
          </View>
          <Text style={styles.agentMessage}>
            Hi! I'm here to help you plan your perfect trip. Share your
            requirements and I'll get back to you with the best options.
          </Text>
        </View>

        {/* Selected Itinerary Info */}
        {itinerary && (
          <View style={styles.itineraryInfo}>
            <Text style={styles.infoTitle}>Selected Itinerary</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>{itinerary.image}</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoName}>{itinerary.title}</Text>
                <Text style={styles.infoDetails}>
                  {destination} • {itinerary.duration}
                </Text>
                {people && (
                  <Text style={styles.infoPeople}>{people} people</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Cart Items Info */}
        {cartItems && cartItems.length > 0 && (
          <View style={styles.itineraryInfo}>
            <Text style={styles.infoTitle}>Cart Items</Text>
            {cartItems.map((item, index) => (
              <View key={index} style={styles.infoCard}>
                <Text style={styles.infoIcon}>{item.image}</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoName}>{item.title}</Text>
                  <Text style={styles.infoDetails}>
                    {item.destination} • {item.duration}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Contact Form */}
        <View style={styles.formSection}>
          <Text style={styles.formTitle}>Your Details</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="+91 98765 43210"
              placeholderTextColor={Colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="your.email@example.com"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Preferred Contact Method</Text>
            <View style={styles.contactMethods}>
              {contactMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.contactMethod,
                    preferredContact === method.id &&
                      styles.contactMethodActive,
                  ]}
                  onPress={() => setPreferredContact(method.id)}
                >
                  <Ionicons name={method.icon} size={18} color={preferredContact === method.id ? Colors.secondary : Colors.primary} style={styles.methodIcon} />
                  <Text
                    style={[
                      styles.methodName,
                      preferredContact === method.id &&
                        styles.methodNameActive,
                    ]}
                  >
                    {method.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Additional Message</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Tell us about your travel preferences, special requirements, or any questions you have..."
              placeholderTextColor={Colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Quick Contact Options */}
        <View style={styles.quickContact}>
          <Text style={styles.quickTitle}>Or Contact Us Directly</Text>
          <View style={styles.quickOptions}>
            <TouchableOpacity style={styles.quickOption}>
              <Ionicons name="call-outline" size={22} color={Colors.primary} style={styles.quickIcon} />
              <Text style={styles.quickText}>Call Now</Text>
              <Text style={styles.quickNumber}>+91 98765 43210</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickOption}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.primary} style={styles.quickIcon} />
              <Text style={styles.quickText}>WhatsApp</Text>
              <Text style={styles.quickNumber}>Chat with us</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 150 }} />
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomAction}>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.secondary} />
          ) : (
            <>
              <Ionicons name="paper-plane" size={18} color={Colors.secondary} style={styles.submitIcon} />
              <Text style={styles.submitButtonText}>Send Request</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  agentSection: {
    padding: 20,
  },
  agentCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 15,
  },
  agentAvatar: {
    marginRight: 15,
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  agentStatus: {
    fontSize: 14,
    color: Colors.success,
    marginTop: 2,
  },
  onlineIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
  },
  agentMessage: {
    fontSize: 16,
    color: Colors.textLight,
    lineHeight: 24,
    backgroundColor: Colors.card,
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  itineraryInfo: {
    padding: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoIcon: {
    fontSize: 40,
    marginRight: 15,
  },
  infoContent: {
    flex: 1,
  },
  infoName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  infoDetails: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 2,
  },
  infoPeople: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  formSection: {
    padding: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageInput: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 120,
  },
  contactMethods: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contactMethod: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginHorizontal: 5,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  contactMethodActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  methodIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  methodName: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  methodNameActive: {
    color: Colors.secondary,
  },
  quickContact: {
    padding: 20,
  },
  quickTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  quickOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickOption: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  quickIcon: {
    fontSize: 30,
    marginBottom: 10,
  },
  quickText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 5,
  },
  quickNumber: {
    fontSize: 12,
    color: Colors.textLight,
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.card,
    padding: 15,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  submitButtonText: {
    color: Colors.secondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default TalkToAgentScreen;
