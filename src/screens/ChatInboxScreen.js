import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';

const ChatInboxScreen = ({ navigation }) => {
  const canGoBack = navigation.canGoBack();
  const { token, user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/messages/conversations/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to load conversations');
      }

      setConversations(Array.isArray(data) ? data : []);
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to load chats');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const getCounterpartyLabel = (conversation) => {
    if (user?.role === 'CUSTOMER') {
      return 'Travel Agent';
    }
    if (user?.role === 'SUPPLIER') {
      return 'Admin';
    }
    if (conversation.type === 'CUSTOMER_ADMIN') {
      return `Customer #${conversation.customerId}`;
    }
    return `Supplier #${conversation.supplierId}`;
  };

  const getSubtitle = (conversation) => {
    return conversation.destination
      ? `Destination: ${conversation.destination}`
      : 'General discussion';
  };

  const openConversation = (conversation) => {
    navigation.navigate('ChatScreen', { conversation });
  };

  const renderConversation = ({ item }) => (
    <TouchableOpacity
      style={styles.chatCard}
      onPress={() => openConversation(item)}
      activeOpacity={0.85}
    >
      <View style={styles.avatarCircle}>
        <Ionicons name="person" size={20} color={Colors.secondary} />
      </View>
      <View style={styles.chatInfo}>
        <Text style={styles.chatTitle}>{getCounterpartyLabel(item)}</Text>
        <Text style={styles.chatSubtitle}>{getSubtitle(item)}</Text>
        {item.summary ? (
          <Text style={styles.summary} numberOfLines={1}>
            {item.summary}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={styles.header}>
        {canGoBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 30 }} />
        )}
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity onPress={loadConversations}>
          <Text style={styles.refresh}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No chats yet</Text>
          <Text style={styles.emptySubtitle}>
            {user?.role === 'CUSTOMER'
              ? 'Open Talk to Agent to start your first chat.'
              : 'Chats will appear here once customers or admins reach out.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderConversation}
          contentContainerStyle={styles.list}
        />
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.secondary },
  refresh: { color: Colors.secondary, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  emptySubtitle: { marginTop: 8, textAlign: 'center', color: Colors.textLight },
  list: { padding: 16, paddingBottom: 96 },
  chatCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatInfo: { flex: 1, marginLeft: 12 },
  chatTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  chatSubtitle: { marginTop: 2, color: Colors.textLight, fontSize: 13, fontWeight: '500' },
  summary: { marginTop: 4, color: Colors.textMuted, fontSize: 12 },
});

export default ChatInboxScreen;
