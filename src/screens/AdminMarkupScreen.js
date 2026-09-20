import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Modal,
  Pressable,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import useResponsive from '../hooks/useResponsive';
import { appAlert } from '../utils/appAlert';
import { useMarkup } from '../context/MarkupContext';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';
import { digitsOnly } from '../utils/inputSanitizers';
import { searchAirlines } from '../data/airlines';

// Mirrors MarkupService.SERVICES and the category split it understands.
const SERVICES = [
  {
    key: 'FLIGHT',
    label: 'Flights',
    icon: 'airplane-outline',
    categories: [
      { key: 'DEFAULT', label: 'All flights (default)' },
      { key: 'DOMESTIC_ONEWAY', label: 'Domestic one way' },
      { key: 'DOMESTIC_ROUND', label: 'Domestic round trip' },
      { key: 'INTERNATIONAL_ONEWAY', label: 'International one way' },
      { key: 'INTERNATIONAL_ROUND', label: 'International round trip' },
    ],
  },
  { key: 'HOTEL', label: 'Hotels', icon: 'business-outline', categories: [{ key: 'DEFAULT', label: 'All hotels' }] },
  { key: 'CAB', label: 'Cabs', icon: 'car-outline', categories: [{ key: 'DEFAULT', label: 'All cabs' }] },
  {
    key: 'ACTIVITY',
    label: 'Activities',
    icon: 'umbrella-outline',
    categories: [{ key: 'DEFAULT', label: 'All activities' }],
  },
  {
    key: 'INSURANCE',
    label: 'Insurance',
    icon: 'shield-checkmark-outline',
    categories: [{ key: 'DEFAULT', label: 'All plans' }],
  },
  {
    key: 'PACKAGE',
    label: 'Packages',
    icon: 'map-outline',
    categories: [
      { key: 'DEFAULT', label: 'All packages (default)' },
      { key: 'DOMESTIC', label: 'Domestic packages' },
      { key: 'INTERNATIONAL', label: 'International packages' },
    ],
  },
];

const UNITS = [
  { key: 'FLAT_FULL', label: 'Flat / booking' },
  { key: 'FLAT_PER_PAX', label: 'Flat / pax' },
  { key: 'PERCENT_FULL', label: '% / booking' },
  { key: 'PERCENT_PER_PAX', label: '% / pax' },
];

const ruleKey = (service, category, entityKey = '') =>
  `${service}|${category}|${(entityKey || '').toUpperCase()}`;

// Which services support a per-entity override, and what the key means.
const OVERRIDE_ENTITIES = {
  FLIGHT: { label: 'Airline', placeholder: 'Carrier code, e.g. 6E' },
  HOTEL: { label: 'Hotel', placeholder: 'Hotel id' },
};

const AdminMarkupScreen = ({ navigation }) => {
  const { token } = useAuth();
  const { centeredContent } = useResponsive();
  // So a saved markup takes effect in search results immediately.
  const { refresh: refreshMarkup } = useMarkup();

  const [rules, setRules] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [overrides, setOverrides] = useState([]);
  const [ruleIds, setRuleIds] = useState({});
  // Airline picker for the FLIGHT override - a two-letter carrier code is not
  // something to type from memory when we have the list.
  const [airlinePicker, setAirlinePicker] = useState(false);
  const [airlineQuery, setAirlineQuery] = useState('');

  // service -> { entityKey, entityLabel, value, unit }
  const [draftOverride, setDraftOverride] = useState({});

  const authHeaders = useCallback(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    [token],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/markup`, { headers: authHeaders() });
      if (!response.ok) throw new Error('Unable to load markup settings.');
      const data = await response.json();
      const next = {};
      const ids = {};
      const overrideList = [];
      (Array.isArray(data) ? data : []).forEach((rule) => {
        const entity = rule.entityKey || '';
        next[ruleKey(rule.service, rule.category, entity)] = {
          value: rule.markupValue != null ? String(Number(rule.markupValue)) : '',
          unit: rule.markupUnit || 'FLAT_FULL',
          active: rule.active !== false,
        };
        ids[ruleKey(rule.service, rule.category, entity)] = rule.id;
        if (entity) overrideList.push({ ...rule, entityKey: entity });
      });
      setRules(next);
      setRuleIds(ids);
      setOverrides(overrideList);
    } catch (error) {
      appAlert('Markup', error.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (key, patch) =>
    setRules((current) => ({
      ...current,
      [key]: { value: '', unit: 'FLAT_FULL', active: true, ...current[key], ...patch },
    }));

  const save = async (service, category, entityKey = '', override = null) => {
    const key = ruleKey(service, category, entityKey);
    const rule = override || rules[key] || {};

    // An empty box means "no rule here", not "zero markup". Writing 0 would
    // create a real rule that beats the service default, which is exactly how
    // a configured markup silently stopped applying.
    if (!override && String(rule.value ?? '').trim() === '') {
      const existingId = ruleIds[key];
      if (!existingId) return;
      try {
        setSavingKey(key);
        await fetch(`${API_CONFIG.BASE_URL}/markup/admin/${existingId}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        await load();
        await refreshMarkup();
      } catch (error) {
        appAlert('Markup', 'Unable to clear this markup.');
      } finally {
        setSavingKey(null);
      }
      return;
    }

    try {
      setSavingKey(key);
      const response = await fetch(`${API_CONFIG.BASE_URL}/markup/admin`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          service,
          category,
          // Normalised here rather than in the input. Uppercasing and trimming
          // on every keystroke rewrites the value the field already holds,
          // which moves the cursor - and the trim made a space impossible to
          // type at all.
          entityKey: (entityKey || '').trim().toUpperCase(),
          entityLabel: override?.entityLabel || null,
          markupValue: rule.value ? Number(rule.value) : 0,
          markupUnit: rule.unit || 'FLAT_FULL',
          active: rule.active !== false,
        }),
      });

      const raw = await response.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }
      if (!response.ok) throw new Error(data?.message || 'Unable to save this markup.');
      setDraftOverride((current) => ({ ...current, [service]: null }));
      await load();
      await refreshMarkup();
    } catch (error) {
      appAlert('Markup', error.message);
    } finally {
      setSavingKey(null);
    }
  };


  const removeOverride = async (rule) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/markup/admin/${rule.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error('Unable to remove this override.');
      await load();
      await refreshMarkup();
    } catch (error) {
      appAlert('Markup', error.message);
    }
  };

  // Per-airline / per-hotel overrides. These beat the service rule above, so an
  // admin only fills in the exceptions.
  const renderOverrides = (service) => {
    const meta = OVERRIDE_ENTITIES[service.key];
    const mine = overrides.filter((o) => o.service === service.key);
    const draft = draftOverride[service.key] || { entityKey: '', entityLabel: '', value: '', unit: 'FLAT_FULL' };
    const setDraft = (patch) =>
      setDraftOverride((current) => ({
        ...current,
        [service.key]: { ...draft, ...patch },
      }));

    return (
      <View style={styles.overrideBlock}>
        <Text style={styles.overrideTitle}>{meta.label}-specific markup</Text>
        <Text style={styles.overrideHint}>
          Overrides the {service.label.toLowerCase()} markup above for one {meta.label.toLowerCase()}.
        </Text>

        {mine.map((rule) => (
          <View key={rule.id} style={styles.overrideRow}>
            <View style={styles.overrideWho}>
              <Text style={styles.overrideCode}>{rule.entityKey}</Text>
              {!!rule.entityLabel && <Text style={styles.overrideName}>{rule.entityLabel}</Text>}
            </View>
            <Text style={styles.overrideValue}>
              {Number(rule.markupValue)}
              {String(rule.markupUnit).startsWith('PERCENT') ? '%' : '₹'}{' '}
              {String(rule.markupUnit).endsWith('PER_PAX') ? '/pax' : '/booking'}
            </Text>
            <TouchableOpacity onPress={() => removeOverride(rule)}>
              <Ionicons name="trash-outline" size={17} color={Colors.error} />
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.overrideForm}>
          {service.key === 'FLIGHT' ? (
            <TouchableOpacity
              style={[styles.valueInput, styles.entityInput, styles.entityPicker]}
              onPress={() => {
                setAirlineQuery('');
                setAirlinePicker(service.key);
              }}
            >
              <Text style={draft.entityKey ? styles.entityPickerValue : styles.entityPickerPlaceholder} numberOfLines={1}>
                {draft.entityKey
                  ? `${draft.entityKey}${draft.entityLabel ? ` · ${draft.entityLabel}` : ''}`
                  : 'Choose an airline'}
              </Text>
              <Ionicons name="chevron-down" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <TextInput
              style={[styles.valueInput, styles.entityInput]}
              placeholder={meta.placeholder}
              placeholderTextColor={Colors.textMuted}
              value={draft.entityKey}
              onChangeText={(value) => setDraft({ entityKey: value })}
              autoCapitalize="characters"
              maxLength={80}
            />
          )}
          {service.key === 'FLIGHT' ? null : (
            <TextInput
              style={[styles.valueInput, styles.entityInput]}
              placeholder="Name (optional)"
              placeholderTextColor={Colors.textMuted}
              value={draft.entityLabel}
              onChangeText={(value) => setDraft({ entityLabel: value })}
              maxLength={160}
            />
          )}
          <TextInput
            style={styles.valueInput}
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            value={draft.value}
            onChangeText={(value) => setDraft({ value: digitsOnly(value) })}
            keyboardType="number-pad"
            maxLength={7}
          />
          <View style={styles.unitRow}>
            {UNITS.map((unit) => {
              const active = draft.unit === unit.key;
              return (
                <TouchableOpacity
                  key={unit.key}
                  style={[styles.unitChip, active && styles.unitChipActive]}
                  onPress={() => setDraft({ unit: unit.key })}
                >
                  <Text style={[styles.unitChipText, active && styles.unitChipTextActive]}>
                    {unit.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => {
              if (!draft.entityKey) {
                appAlert('Markup', `Enter a ${meta.label.toLowerCase()} first.`);
                return;
              }
              save(service.key, 'DEFAULT', draft.entityKey, draft);
            }}
          >
            <Text style={styles.saveButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };


  const renderCategory = (service, category) => {
    const key = ruleKey(service.key, category.key);
    const rule = rules[key] || { value: '', unit: 'FLAT_FULL', active: true };
    const isPercent = (rule.unit || '').startsWith('PERCENT');

    return (
      <View key={key} style={styles.ruleRow}>
        <View style={styles.ruleLabelRow}>
          <Text style={styles.ruleLabel}>{category.label}</Text>
          {ruleIds[key] ? (
            <Text style={styles.ruleActiveTag}>set</Text>
          ) : (
            <Text style={styles.ruleInheritTag}>
              {category.key === 'DEFAULT' ? 'not set' : 'using default'}
            </Text>
          )}
        </View>

        <View style={styles.ruleControls}>
          <TextInput
            style={styles.valueInput}
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            value={rule.value}
            onChangeText={(value) => update(key, { value: digitsOnly(value) })}
            keyboardType="number-pad"
            maxLength={isPercent ? 3 : 7}
          />

          <View style={styles.unitRow}>
            {UNITS.map((unit) => {
              const active = (rule.unit || 'FLAT_FULL') === unit.key;
              return (
                <TouchableOpacity
                  key={unit.key}
                  style={[styles.unitChip, active && styles.unitChipActive]}
                  onPress={() => update(key, { unit: unit.key })}
                >
                  <Text style={[styles.unitChipText, active && styles.unitChipTextActive]}>
                    {unit.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => save(service.key, category.key)}
            disabled={savingKey === key}
          >
            {savingKey === key ? (
              <ActivityIndicator color={Colors.secondary} size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Markup</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={[styles.body, centeredContent]}>
          <View style={styles.noticeCard}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.accentBlue} />
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>How markup is charged</Text>
              <Text style={styles.noticeText}>
                The supplier is always paid their exact fare — TripJack rejects a booking that
                pays anything else. Markup is what you add on top and collect on your own payment
                rail, and it's the only amount a coupon can discount.
              </Text>
            </View>
          </View>

          {SERVICES.map((service) => (
            <View key={service.key} style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <Ionicons name={service.icon} size={20} color={Colors.primary} />
                <Text style={styles.serviceTitle}>{service.label}</Text>
              </View>
              {service.categories.map((category) => renderCategory(service, category))}

              {OVERRIDE_ENTITIES[service.key] ? renderOverrides(service) : null}
            </View>
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <Modal visible={!!airlinePicker} transparent animationType="fade" onRequestClose={() => setAirlinePicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setAirlinePicker(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choose an airline</Text>
              <TouchableOpacity onPress={() => setAirlinePicker(false)}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.pickerSearch}
              placeholder="Search by name or code"
              placeholderTextColor={Colors.textMuted}
              value={airlineQuery}
              onChangeText={setAirlineQuery}
              autoCapitalize="none"
            />
            <FlatList
              data={searchAirlines(airlineQuery, 60)}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              style={styles.pickerList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    // Both fields come from the picked airline, so the code and
                    // the name can never disagree.
                    setDraftOverride((current) => {
                      const existing = current[airlinePicker]
                        || { entityKey: '', entityLabel: '', value: '', unit: 'FLAT_FULL' };
                      return {
                        ...current,
                        [airlinePicker]: { ...existing, entityKey: item.code, entityLabel: item.name },
                      };
                    });
                    setAirlinePicker(false);
                  }}
                >
                  <Text style={styles.pickerCode}>{item.code}</Text>
                  <Text style={styles.pickerName} numberOfLines={1}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.pickerEmpty}>No airline matches "{airlineQuery.trim()}".</Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  entityPicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  entityPickerValue: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.text },
  entityPickerPlaceholder: { flex: 1, fontSize: 13, color: Colors.textMuted },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 34, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  pickerCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pickerTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  pickerSearch: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 10,
  },
  pickerList: { maxHeight: 380 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerCode: { width: 34, fontSize: 13, fontWeight: '800', color: Colors.primaryDark },
  pickerName: { flex: 1, fontSize: 13.5, color: Colors.text },
  pickerEmpty: { paddingVertical: 18, fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.secondary },
  body: { padding: 16, gap: 16 },

  noticeCard: {
    flexDirection: 'row',
    gap: 11,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.accentBlueSoft,
    borderWidth: 1,
    borderColor: Colors.accentBlue,
  },
  noticeCopy: { flex: 1, gap: 5 },
  noticeTitle: { fontSize: 13.5, fontWeight: '800', color: Colors.accentBlueDark },
  noticeText: { fontSize: 12, lineHeight: 18, color: Colors.textLight },

  serviceCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  serviceHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  serviceTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },

  ruleRow: { gap: 8 },
  ruleLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleActiveTag: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primaryDark,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  ruleInheritTag: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
  },

  ruleLabel: { fontSize: 13, fontWeight: '700', color: Colors.textLight },
  ruleControls: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  valueInput: {
    width: 90,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    outlineStyle: 'none',
  },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 200 },
  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unitChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  unitChipText: { fontSize: 11.5, fontWeight: '700', color: Colors.textLight },
  unitChipTextActive: { color: Colors.primaryDark },
  overrideBlock: {
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  overrideTitle: { fontSize: 13.5, fontWeight: '800', color: Colors.text },
  overrideHint: { fontSize: 11.5, color: Colors.textMuted, lineHeight: 16 },
  overrideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  overrideWho: { flex: 1, gap: 1 },
  overrideCode: { fontSize: 13, fontWeight: '800', color: Colors.primaryDark },
  overrideName: { fontSize: 11.5, color: Colors.textMuted },
  overrideValue: { fontSize: 12.5, fontWeight: '700', color: Colors.text },
  overrideForm: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  entityInput: { width: 140 },

  saveButton: {
    paddingHorizontal: 18,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { fontSize: 13.5, fontWeight: '800', color: Colors.secondary },
});

export default AdminMarkupScreen;
