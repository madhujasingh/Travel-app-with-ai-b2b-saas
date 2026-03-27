import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';

const ChatScreen = ({ route, navigation }) => {
  const { token, user } = useAuth();
  const { conversation } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [submittingTemplate, setSubmittingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    title: '',
    destination: conversation?.destination || '',
    duration: '',
    price: '',
    type: 'PREMIUM',
    category: 'INDIA',
    highlights: '',
    inclusions: '',
    exclusions: '',
    notes: '',
    imageUrl: '',
  });

  const isSupplierTemplateConversation =
    user?.role === 'SUPPLIER' && conversation?.type === 'SUPPLIER_ADMIN';

  const title = useMemo(() => {
    if (user?.role === 'CUSTOMER') {
      return 'Travel Agent';
    }
    if (user?.role === 'SUPPLIER') {
      return 'Admin';
    }
    return conversation?.type === 'CUSTOMER_ADMIN'
      ? `Customer #${conversation?.customerId}`
      : `Supplier #${conversation?.supplierId}`;
  }, [conversation, user?.role]);

  const loadMessages = useCallback(async () => {
    if (!token || !conversation?.id) {
      return;
    }

    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/messages/conversations/${conversation.id}/messages`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to load messages');
      }

      setMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to load chat');
    }
  }, [conversation?.id, token]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const sendMessage = async () => {
    const trimmed = content.trim();
    if (!trimmed || !token || !conversation?.id || sending) {
      return;
    }

    setSending(true);
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/messages/conversations/${conversation.id}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: trimmed }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to send message');
      }

      setMessages((prev) => [...prev, data]);
      setContent('');
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to send message');
    } finally {
      setSending(false);
    }
  };

  const handleForwardToSupplier = async () => {
    if (user?.role !== 'ADMIN' || conversation?.type !== 'CUSTOMER_ADMIN' || forwarding) {
      return;
    }

    setForwarding(true);
    try {
      const supplierRes = await fetch(`${API_CONFIG.BASE_URL}/messages/suppliers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const suppliers = await supplierRes.json();
      if (!supplierRes.ok) {
        throw new Error(suppliers?.message || 'Failed to load suppliers');
      }
      if (!Array.isArray(suppliers) || suppliers.length === 0) {
        throw new Error('No supplier accounts available');
      }

      const pickSupplier = (supplier) => ({
        text: supplier.name,
        onPress: async () => {
          try {
            const startRes = await fetch(
              `${API_CONFIG.BASE_URL}/messages/conversations/supplier/start`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  supplierId: supplier.id,
                  itineraryId: conversation.itineraryId,
                  destination: conversation.destination,
                  numberOfPeople: conversation.numberOfPeople,
                  budget: conversation.budget,
                  summary: conversation.summary,
                  initialMessage: `Forwarded by admin from customer conversation #${conversation.id}. Please draft itinerary options.`,
                }),
              }
            );

            const newConversation = await startRes.json();
            if (!startRes.ok) {
              throw new Error(newConversation?.message || 'Failed to start supplier chat');
            }

            navigation.push('ChatScreen', { conversation: newConversation });
          } catch (error) {
            Alert.alert('Error', error.message || 'Unable to forward conversation');
          }
        },
      });

      Alert.alert(
        'Forward To Supplier',
        'Select supplier to continue this request.',
        [...suppliers.slice(0, 3).map(pickSupplier), { text: 'Cancel', style: 'cancel' }]
      );
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to load suppliers');
    } finally {
      setForwarding(false);
    }
  };

  const updateTemplateField = (field, value) => {
    setTemplateForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitSupplierTemplate = async () => {
    if (!isSupplierTemplateConversation || !token || !conversation?.id || submittingTemplate) {
      return;
    }

    if (
      !templateForm.title.trim() ||
      !templateForm.destination.trim() ||
      !templateForm.duration.trim() ||
      !templateForm.price.trim()
    ) {
      Alert.alert('Missing details', 'Please fill title, destination, duration and price.');
      return;
    }

    setSubmittingTemplate(true);
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/messages/conversations/${conversation.id}/supplier-itinerary`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(templateForm),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to submit itinerary proposal');
      }

      setTemplateForm((prev) => ({
        ...prev,
        title: '',
        duration: '',
        price: '',
        highlights: '',
        inclusions: '',
        exclusions: '',
        notes: '',
        imageUrl: '',
      }));

      await loadMessages();
      Alert.alert('Sent', `Itinerary proposal #${data?.itineraryId || ''} sent to admin.`);
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to submit itinerary proposal');
    } finally {
      setSubmittingTemplate(false);
    }
  };

  const renderMessage = ({ item }) => {
    const mine = item.senderId === user?.id;
    const senderLabel = mine
      ? 'You'
      : user?.role === 'CUSTOMER' && item.senderRole === 'ADMIN'
        ? 'Travel Agent'
        : item.senderRole;

    return (
      <View style={[styles.messageWrap, mine ? styles.mineWrap : styles.theirWrap]}>
        <View style={[styles.messageBubble, mine ? styles.mine : styles.theirs]}>
          <Text style={styles.sender}>{senderLabel}</Text>
          <Text style={[styles.messageText, mine && styles.mineText]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSubtitle}>{conversation?.destination || 'Conversation'}</Text>
        </View>
        <TouchableOpacity onPress={loadMessages}>
          <Ionicons name="refresh" size={20} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      {user?.role === 'ADMIN' && conversation?.type === 'CUSTOMER_ADMIN' ? (
        <View style={styles.forwardSection}>
          <TouchableOpacity
            style={[styles.forwardButton, forwarding && styles.sendButtonDisabled]}
            onPress={handleForwardToSupplier}
            disabled={forwarding}
          >
            <Text style={styles.forwardButtonText}>Forward This Request To Supplier</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isSupplierTemplateConversation ? (
        <View style={styles.templateCard}>
          <Text style={styles.templateTitle}>Create Itinerary Proposal</Text>
          <Text style={styles.templateHint}>
            Fill this template and send to admin directly in this chat.
          </Text>

          <TextInput
            style={styles.templateInput}
            value={templateForm.title}
            onChangeText={(value) => updateTemplateField('title', value)}
            placeholder="Title (e.g. 5D4N Jaipur Getaway)"
            placeholderTextColor={Colors.textMuted}
          />
          <TextInput
            style={styles.templateInput}
            value={templateForm.destination}
            onChangeText={(value) => updateTemplateField('destination', value)}
            placeholder="Destination"
            placeholderTextColor={Colors.textMuted}
          />
          <View style={styles.templateRow}>
            <TextInput
              style={[styles.templateInput, styles.templateHalf]}
              value={templateForm.duration}
              onChangeText={(value) => updateTemplateField('duration', value)}
              placeholder="Duration"
              placeholderTextColor={Colors.textMuted}
            />
            <TextInput
              style={[styles.templateInput, styles.templateHalf]}
              value={templateForm.price}
              onChangeText={(value) => updateTemplateField('price', value)}
              placeholder="Price (INR)"
              keyboardType="numeric"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.templateRow}>
            <TextInput
              style={[styles.templateInput, styles.templateHalf]}
              value={templateForm.type}
              onChangeText={(value) => updateTemplateField('type', value)}
              placeholder="Type: PREMIUM"
              autoCapitalize="characters"
              placeholderTextColor={Colors.textMuted}
            />
            <TextInput
              style={[styles.templateInput, styles.templateHalf]}
              value={templateForm.category}
              onChangeText={(value) => updateTemplateField('category', value)}
              placeholder="Category: INDIA"
              autoCapitalize="characters"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <TextInput
            style={styles.templateInput}
            value={templateForm.highlights}
            onChangeText={(value) => updateTemplateField('highlights', value)}
            placeholder="Highlights (comma or new line)"
            placeholderTextColor={Colors.textMuted}
            multiline
          />
          <TextInput
            style={styles.templateInput}
            value={templateForm.inclusions}
            onChangeText={(value) => updateTemplateField('inclusions', value)}
            placeholder="Inclusions (comma or new line)"
            placeholderTextColor={Colors.textMuted}
            multiline
          />
          <TextInput
            style={styles.templateInput}
            value={templateForm.exclusions}
            onChangeText={(value) => updateTemplateField('exclusions', value)}
            placeholder="Exclusions (comma or new line)"
            placeholderTextColor={Colors.textMuted}
            multiline
          />
          <TextInput
            style={styles.templateInput}
            value={templateForm.imageUrl}
            onChangeText={(value) => updateTemplateField('imageUrl', value)}
            placeholder="Image URL (optional)"
            placeholderTextColor={Colors.textMuted}
          />
          <TextInput
            style={[styles.templateInput, styles.templateNotes]}
            value={templateForm.notes}
            onChangeText={(value) => updateTemplateField('notes', value)}
            placeholder="Supplier notes"
            placeholderTextColor={Colors.textMuted}
            multiline
          />

          <TouchableOpacity
            style={[styles.templateSubmitButton, submittingTemplate && styles.sendButtonDisabled]}
            onPress={submitSupplierTemplate}
            disabled={submittingTemplate}
          >
            <Text style={styles.templateSubmitText}>
              {submittingTemplate ? 'Sending...' : 'Send Proposal To Admin'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.list}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={content}
            onChangeText={setContent}
            placeholder="Type your message"
            placeholderTextColor={Colors.textMuted}
          />
          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={sending}
          >
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerTitle: { color: Colors.secondary, fontSize: 18, fontWeight: '700' },
  headerSubtitle: { color: Colors.secondary, opacity: 0.9, fontSize: 12 },
  list: { padding: 14, paddingBottom: 26 },
  forwardSection: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 2,
  },
  forwardButton: {
    backgroundColor: '#1976D2',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  forwardButtonText: {
    color: Colors.secondary,
    fontWeight: '700',
  },
  templateCard: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    padding: 12,
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  templateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  templateHint: {
    marginTop: 4,
    marginBottom: 10,
    color: Colors.textMuted,
    fontSize: 12,
  },
  templateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  templateInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
    backgroundColor: Colors.background,
    color: Colors.text,
  },
  templateHalf: {
    flex: 1,
  },
  templateNotes: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  templateSubmitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 2,
  },
  templateSubmitText: {
    color: Colors.secondary,
    fontWeight: '700',
  },
  messageWrap: { marginBottom: 10, flexDirection: 'row' },
  mineWrap: { justifyContent: 'flex-end' },
  theirWrap: { justifyContent: 'flex-start' },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mine: { backgroundColor: Colors.primary },
  theirs: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  sender: { fontSize: 10, opacity: 0.8, marginBottom: 4, color: Colors.textLight },
  messageText: { fontSize: 15, color: Colors.text },
  mineText: { color: Colors.secondary },
  inputRow: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.secondary,
    color: Colors.text,
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButtonDisabled: { opacity: 0.7 },
  sendText: { color: Colors.secondary, fontWeight: '700' },
});

export default ChatScreen;
