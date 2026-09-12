import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  Pressable,
  Switch,
  StatusBar,
} from 'react-native';
import useResponsive from '../hooks/useResponsive';
import { appAlert } from '../utils/appAlert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';
import DatePickerModal from '../components/DatePickerModal';
import { digitsOnly } from '../utils/inputSanitizers';

const DISCOUNT_TYPES = [
  { value: 'PERCENT', label: 'Percentage' },
  { value: 'FLAT', label: 'Flat amount' },
];

// Must match the keys CouponService.appliesTo() compares against.
const PRODUCTS = ['FLIGHT', 'HOTEL', 'CAB', 'ACTIVITY', 'PACKAGE', 'INSURANCE'];

const emptyDraft = () => ({
  id: null,
  code: '',
  description: '',
  discountType: 'PERCENT',
  discountValue: '',
  maxDiscountAmount: '',
  minOrderAmount: '',
  validFrom: '',
  validUntil: '',
  active: true,
  usageLimit: '',
  perUserLimit: '',
  products: [],
});

const toIsoDateTime = (value, endOfDay) =>
  value ? `${value}T${endOfDay ? '23:59:59' : '00:00:00'}` : null;

const fromIsoDate = (value) => (value ? String(value).slice(0, 10) : '');

const AdminCouponsScreen = ({ navigation }) => {
  const { token } = useAuth();
  const { centeredContent, isDesktop } = useResponsive();

  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [datePicker, setDatePicker] = useState({ visible: false, target: null });

  const authHeaders = useCallback(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    [token],
  );

  const loadCoupons = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/coupons/admin`, {
        headers: authHeaders(),
      });
      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? 'Only admins can manage coupons.'
            : 'Unable to load coupons right now.',
        );
      }
      setCoupons(await response.json());
    } catch (error) {
      appAlert('Coupons', error.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const openCreate = () => {
    setDraft(emptyDraft());
    setEditorVisible(true);
  };

  const openEdit = (coupon) => {
    setDraft({
      id: coupon.id,
      code: coupon.code || '',
      description: coupon.description || '',
      discountType: coupon.discountType || 'PERCENT',
      discountValue: coupon.discountValue != null ? String(coupon.discountValue) : '',
      maxDiscountAmount: coupon.maxDiscountAmount != null ? String(coupon.maxDiscountAmount) : '',
      minOrderAmount: coupon.minOrderAmount != null ? String(coupon.minOrderAmount) : '',
      validFrom: fromIsoDate(coupon.validFrom),
      validUntil: fromIsoDate(coupon.validUntil),
      active: coupon.active !== false,
      usageLimit: coupon.usageLimit != null ? String(coupon.usageLimit) : '',
      perUserLimit: coupon.perUserLimit != null ? String(coupon.perUserLimit) : '',
      products:
        !coupon.applicableProducts || coupon.applicableProducts === 'ALL'
          ? []
          : coupon.applicableProducts.split(',').map((p) => p.trim()),
    });
    setEditorVisible(true);
  };

  const toggleProduct = (product) =>
    setDraft((current) => ({
      ...current,
      products: current.products.includes(product)
        ? current.products.filter((p) => p !== product)
        : [...current.products, product],
    }));

  const save = async () => {
    const payload = {
      code: draft.code.trim().toUpperCase(),
      description: draft.description.trim() || null,
      discountType: draft.discountType,
      discountValue: draft.discountValue ? Number(draft.discountValue) : null,
      maxDiscountAmount: draft.maxDiscountAmount ? Number(draft.maxDiscountAmount) : null,
      minOrderAmount: draft.minOrderAmount ? Number(draft.minOrderAmount) : null,
      validFrom: toIsoDateTime(draft.validFrom, false),
      validUntil: toIsoDateTime(draft.validUntil, true),
      active: draft.active,
      usageLimit: draft.usageLimit ? Number(draft.usageLimit) : null,
      perUserLimit: draft.perUserLimit ? Number(draft.perUserLimit) : null,
      // Empty selection means every product.
      applicableProducts: draft.products.length ? draft.products.join(',') : 'ALL',
    };

    try {
      setSaving(true);
      const response = await fetch(
        draft.id
          ? `${API_CONFIG.BASE_URL}/coupons/admin/${draft.id}`
          : `${API_CONFIG.BASE_URL}/coupons/admin`,
        { method: draft.id ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(payload) },
      );

      const raw = await response.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(data?.message || 'Unable to save this coupon.');
      }

      setEditorVisible(false);
      await loadCoupons();
    } catch (error) {
      appAlert('Coupons', error.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (coupon) =>
    appAlert('Delete coupon', `Delete ${coupon.code}? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/coupons/admin/${coupon.id}`, {
              method: 'DELETE',
              headers: authHeaders(),
            });
            if (!response.ok) throw new Error('Unable to delete this coupon.');
            await loadCoupons();
          } catch (error) {
            appAlert('Coupons', error.message);
          }
        },
      },
    ]);

  const toggleActive = async (coupon) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/coupons/admin/${coupon.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ ...coupon, active: !coupon.active }),
      });
      if (!response.ok) throw new Error('Unable to update this coupon.');
      await loadCoupons();
    } catch (error) {
      appAlert('Coupons', error.message);
    }
  };

  const describe = (coupon) => {
    const value =
      coupon.discountType === 'PERCENT'
        ? `${Number(coupon.discountValue)}% off`
        : `₹${Number(coupon.discountValue).toLocaleString('en-IN')} off`;
    const cap =
      coupon.discountType === 'PERCENT' && coupon.maxDiscountAmount
        ? ` up to ₹${Number(coupon.maxDiscountAmount).toLocaleString('en-IN')}`
        : '';
    return `${value}${cap}`;
  };

  const renderCoupon = (coupon) => {
    const used = coupon.timesUsed || 0;
    const limit = coupon.usageLimit;
    const expired = coupon.validUntil && new Date(coupon.validUntil) < new Date();

    return (
      <View key={coupon.id} style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.codeWrap}>
            <Text style={styles.code}>{coupon.code}</Text>
            {expired ? (
              <View style={[styles.badge, styles.badgeMuted]}>
                <Text style={styles.badgeMutedText}>Expired</Text>
              </View>
            ) : null}
            {!coupon.active ? (
              <View style={[styles.badge, styles.badgeMuted]}>
                <Text style={styles.badgeMutedText}>Paused</Text>
              </View>
            ) : null}
          </View>
          <Switch
            value={!!coupon.active}
            onValueChange={() => toggleActive(coupon)}
            trackColor={{ true: Colors.primaryLight, false: Colors.border }}
            thumbColor={coupon.active ? Colors.primary : '#f4f3f4'}
          />
        </View>

        <Text style={styles.discount}>{describe(coupon)}</Text>
        {!!coupon.description && <Text style={styles.description}>{coupon.description}</Text>}

        <View style={styles.metaRow}>
          {coupon.minOrderAmount ? (
            <Text style={styles.meta}>
              Min order ₹{Number(coupon.minOrderAmount).toLocaleString('en-IN')}
            </Text>
          ) : null}
          <Text style={styles.meta}>
            Used {used}
            {limit ? ` / ${limit}` : ''}
          </Text>
          {coupon.perUserLimit ? (
            <Text style={styles.meta}>{coupon.perUserLimit} per customer</Text>
          ) : null}
          <Text style={styles.meta}>
            {coupon.applicableProducts === 'ALL'
              ? 'All products'
              : coupon.applicableProducts.split(',').join(', ')}
          </Text>
          {coupon.validUntil ? (
            <Text style={styles.meta}>Until {fromIsoDate(coupon.validUntil)}</Text>
          ) : null}
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => openEdit(coupon)}>
            <Ionicons name="create-outline" size={16} color={Colors.primary} />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => confirmDelete(coupon)}>
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
            <Text style={[styles.actionText, { color: Colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const Field = ({ label, hint, children }) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {!!hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Coupon Codes</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add" size={28} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={[styles.list, centeredContent]}>
          <TouchableOpacity style={styles.createButton} onPress={openCreate}>
            <Ionicons name="pricetag-outline" size={18} color={Colors.secondary} />
            <Text style={styles.createButtonText}>Create a coupon</Text>
          </TouchableOpacity>

          {/* Discounts come out of our margin, never the supplier's share -
              TripJack and HotelBeds must be paid their exact amount. Saying so
              here avoids coupons being created that silently never apply. */}
          <View style={styles.noticeCard}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.accentBlue} />
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>Discounts come out of your margin</Text>
              <Text style={styles.noticeText}>
                TripJack and HotelBeds must receive their exact fare, so a coupon can only
                reduce what you charge on top.
              </Text>
              <Text style={styles.noticeText}>
                • <Text style={styles.noticeStrong}>Packages</Text> — your own inventory, fully
                discountable.{'\n'}
                • <Text style={styles.noticeStrong}>Flights</Text> — capped at the convenience fee
                (currently set in Platform Settings).{'\n'}
                • <Text style={styles.noticeStrong}>Hotels, cabs, activities, insurance</Text> — no
                fee of yours is charged yet, so coupons won't apply until one is added.
              </Text>
            </View>
          </View>

          {coupons.length === 0 ? (
            <Text style={styles.emptyText}>
              No coupons yet. Create one and customers can apply it at checkout.
            </Text>
          ) : (
            <View style={isDesktop ? styles.grid : null}>{coupons.map(renderCoupon)}</View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={editorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditorVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditorVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{draft.id ? 'Edit coupon' : 'New coupon'}</Text>
              <TouchableOpacity onPress={() => setEditorVisible(false)}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
              <Field label="Code" hint="Letters, numbers, hyphens and underscores. Stored uppercase.">
                <TextInput
                  style={styles.input}
                  placeholder="SAVE20"
                  placeholderTextColor={Colors.textMuted}
                  value={draft.code}
                  onChangeText={(value) =>
                    setDraft((c) => ({ ...c, code: value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))
                  }
                  autoCapitalize="characters"
                  maxLength={40}
                />
              </Field>

              <Field label="Description" hint="Shown to the customer when the code applies.">
                <TextInput
                  style={styles.input}
                  placeholder="20% off your first hotel booking"
                  placeholderTextColor={Colors.textMuted}
                  value={draft.description}
                  onChangeText={(value) => setDraft((c) => ({ ...c, description: value }))}
                />
              </Field>

              <Field label="Discount type">
                <View style={styles.chipRow}>
                  {DISCOUNT_TYPES.map((type) => {
                    const active = draft.discountType === type.value;
                    return (
                      <TouchableOpacity
                        key={type.value}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setDraft((c) => ({ ...c, discountType: type.value }))}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Field>

              <Field label={draft.discountType === 'PERCENT' ? 'Percentage off' : 'Amount off (₹)'}>
                <TextInput
                  style={styles.input}
                  placeholder={draft.discountType === 'PERCENT' ? '20' : '1000'}
                  placeholderTextColor={Colors.textMuted}
                  value={draft.discountValue}
                  onChangeText={(value) => setDraft((c) => ({ ...c, discountValue: digitsOnly(value) }))}
                  keyboardType="number-pad"
                  maxLength={draft.discountType === 'PERCENT' ? 3 : 8}
                />
              </Field>

              {draft.discountType === 'PERCENT' ? (
                <Field label="Maximum discount (₹)" hint="Optional cap, e.g. 20% off up to ₹2,000.">
                  <TextInput
                    style={styles.input}
                    placeholder="2000"
                    placeholderTextColor={Colors.textMuted}
                    value={draft.maxDiscountAmount}
                    onChangeText={(value) =>
                      setDraft((c) => ({ ...c, maxDiscountAmount: digitsOnly(value) }))
                    }
                    keyboardType="number-pad"
                    maxLength={8}
                  />
                </Field>
              ) : null}

              <Field label="Minimum order (₹)" hint="Optional. The code won't apply below this.">
                <TextInput
                  style={styles.input}
                  placeholder="5000"
                  placeholderTextColor={Colors.textMuted}
                  value={draft.minOrderAmount}
                  onChangeText={(value) => setDraft((c) => ({ ...c, minOrderAmount: digitsOnly(value) }))}
                  keyboardType="number-pad"
                  maxLength={8}
                />
              </Field>

              <View style={styles.row}>
                <Field label="Valid from">
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => setDatePicker({ visible: true, target: 'validFrom' })}
                  >
                    <Text style={draft.validFrom ? styles.inputText : styles.inputPlaceholder}>
                      {draft.validFrom || 'Any time'}
                    </Text>
                  </TouchableOpacity>
                </Field>
                <Field label="Valid until">
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => setDatePicker({ visible: true, target: 'validUntil' })}
                  >
                    <Text style={draft.validUntil ? styles.inputText : styles.inputPlaceholder}>
                      {draft.validUntil || 'No expiry'}
                    </Text>
                  </TouchableOpacity>
                </Field>
              </View>

              <View style={styles.row}>
                <Field label="Total uses" hint="Blank = unlimited.">
                  <TextInput
                    style={styles.input}
                    placeholder="100"
                    placeholderTextColor={Colors.textMuted}
                    value={draft.usageLimit}
                    onChangeText={(value) => setDraft((c) => ({ ...c, usageLimit: digitsOnly(value) }))}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </Field>
                <Field label="Per customer" hint="Blank = unlimited.">
                  <TextInput
                    style={styles.input}
                    placeholder="1"
                    placeholderTextColor={Colors.textMuted}
                    value={draft.perUserLimit}
                    onChangeText={(value) => setDraft((c) => ({ ...c, perUserLimit: digitsOnly(value) }))}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </Field>
              </View>

              <Field
                label="Applies to"
                hint="Select none to apply to everything."
              >
                <View style={styles.chipRow}>
                  {PRODUCTS.map((product) => {
                    const active = draft.products.includes(product);
                    return (
                      <TouchableOpacity
                        key={product}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => toggleProduct(product)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {product}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Field>

              <View style={styles.activeRow}>
                <Text style={styles.fieldLabel}>Active</Text>
                <Switch
                  value={draft.active}
                  onValueChange={(value) => setDraft((c) => ({ ...c, active: value }))}
                  trackColor={{ true: Colors.primaryLight, false: Colors.border }}
                  thumbColor={draft.active ? Colors.primary : '#f4f3f4'}
                />
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={Colors.secondary} />
              ) : (
                <Text style={styles.saveButtonText}>{draft.id ? 'Save changes' : 'Create coupon'}</Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <DatePickerModal
        visible={datePicker.visible}
        title={datePicker.target === 'validFrom' ? 'Valid from' : 'Valid until'}
        onSelect={(date) => {
          const iso = new Date(date).toISOString().slice(0, 10);
          setDraft((c) => ({ ...c, [datePicker.target]: iso }));
          setDatePicker({ visible: false, target: null });
        }}
        onClose={() => setDatePicker({ visible: false, target: null })}
      />
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
    padding: 15,
    paddingTop: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.secondary },
  list: { padding: 16, gap: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
  },
  createButtonText: { fontSize: 15, fontWeight: '800', color: Colors.secondary },
  emptyText: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 24,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  noticeCard: {
    flexDirection: 'row',
    gap: 11,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.accentBlueSoft,
    borderWidth: 1,
    borderColor: Colors.accentBlue,
  },
  noticeCopy: { flex: 1, gap: 6 },
  noticeTitle: { fontSize: 13.5, fontWeight: '800', color: Colors.accentBlueDark },
  noticeText: { fontSize: 12, lineHeight: 18, color: Colors.textLight },
  noticeStrong: { fontWeight: '800', color: Colors.text },

  card: {
    flexGrow: 1,
    minWidth: 300,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  code: { fontSize: 18, fontWeight: '900', color: Colors.primaryDark, letterSpacing: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeMuted: { backgroundColor: Colors.backgroundAlt },
  badgeMutedText: { fontSize: 10.5, fontWeight: '800', color: Colors.textMuted },
  discount: { fontSize: 15, fontWeight: '700', color: Colors.text },
  description: { fontSize: 13, color: Colors.textLight, lineHeight: 18 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  meta: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.textMuted,
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardActions: { flexDirection: 'row', gap: 16, marginTop: 6 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 34, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    alignSelf: 'center',
    backgroundColor: Colors.background,
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  modalBody: { gap: 14, paddingBottom: 8 },
  field: { flex: 1, gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Colors.text },
  fieldHint: { fontSize: 11.5, color: Colors.textMuted, lineHeight: 16 },
  input: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    outlineStyle: 'none',
  },
  inputText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  inputPlaceholder: { fontSize: 14, fontWeight: '500', color: Colors.textMuted },
  row: { flexDirection: 'row', gap: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  chipText: { fontSize: 12.5, fontWeight: '700', color: Colors.textLight },
  chipTextActive: { color: Colors.primaryDark },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveButtonText: { fontSize: 15, fontWeight: '800', color: Colors.secondary },
});

export default AdminCouponsScreen;
