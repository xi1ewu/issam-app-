import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, Share, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../hooks/useAppTheme';
import { invoiceAPI, InvoiceLine } from '../../services/api';

const TEAL = '#00D598';
const NAVY = '#0A1628';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#94A3B8',
  SENT: '#3B82F6',
  PAID: '#10B981',
  OVERDUE: '#EF4444',
};

interface Props { onBack: () => void }

type ScreenView = 'list' | 'create' | 'detail';

export const InvoiceScreen: React.FC<Props> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useAppTheme();
  const bg = isDark ? '#0D1B2A' : '#F8FAFC';
  const card = isDark ? '#1E2A3A' : '#fff';
  const text = isDark ? '#E8ECF0' : NAVY;
  const muted = isDark ? '#9BA8B4' : '#64748B';

  const [view, setView] = useState<ScreenView>('list');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  // Form state
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<InvoiceLine[]>([
    { description: '', quantity: 1, rate: 0, amount: 0 },
  ]);

  useEffect(() => { loadInvoices(); }, []);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await invoiceAPI.getAll();
      setInvoices(data);
    } catch { /* expert not set up yet — show empty list */ }
    finally { setLoading(false); }
  };

  const updateLine = (index: number, field: keyof InvoiceLine, raw: string) => {
    setLines(prev => {
      const next = [...prev];
      const line = { ...next[index] };
      if (field === 'description') {
        line.description = raw;
      } else {
        const n = parseFloat(raw) || 0;
        (line as any)[field] = n;
        line.amount = line.quantity * line.rate;
      }
      next[index] = line;
      return next;
    });
  };

  const addLine = () =>
    setLines(prev => [...prev, { description: '', quantity: 1, rate: 0, amount: 0 }]);

  const removeLine = (i: number) =>
    setLines(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);

  const handleCreate = async () => {
    if (!clientName.trim()) { Alert.alert('Required', 'Enter the client name.'); return; }
    if (lines.some(l => !l.description.trim())) { Alert.alert('Required', 'All service lines need a description.'); return; }
    if (lines.some(l => l.amount <= 0)) { Alert.alert('Required', 'All service lines need a non-zero amount.'); return; }

    setSaving(true);
    try {
      const invoice = await invoiceAPI.create({
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        services: lines,
        dueDate: dueDate.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setInvoices(prev => [invoice, ...prev]);
      Alert.alert('Invoice Created', `Invoice ${invoice.invoiceNumber} created successfully.`);
      resetForm();
      setView('list');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create invoice.');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setClientName(''); setClientEmail(''); setDueDate(''); setNotes('');
    setLines([{ description: '', quantity: 1, rate: 0, amount: 0 }]);
  };

  const handleStatusChange = async (inv: any, status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE') => {
    try {
      const updated = await invoiceAPI.updateStatus(inv.id, status);
      setInvoices(prev => prev.map(i => i.id === inv.id ? updated : i));
      if (selected?.id === inv.id) setSelected(updated);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update status.');
    }
  };

  const handleDelete = (inv: any) => {
    Alert.alert('Delete Invoice', `Delete ${inv.invoiceNumber}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await invoiceAPI.delete(inv.id);
            setInvoices(prev => prev.filter(i => i.id !== inv.id));
            setView('list');
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to delete invoice.');
          }
        },
      },
    ]);
  };

  const handleShare = (inv: any) => {
    const services = (inv.services as InvoiceLine[])
      .map(s => `  • ${s.description}: ${s.quantity} × $${s.rate.toFixed(2)} = $${s.amount.toFixed(2)}`)
      .join('\n');
    Share.share({
      message:
        `INVOICE ${inv.invoiceNumber}\n` +
        `─────────────────────\n` +
        `Client: ${inv.clientName}\n` +
        (inv.clientEmail ? `Email: ${inv.clientEmail}\n` : '') +
        (inv.dueDate ? `Due: ${inv.dueDate}\n` : '') +
        `\nServices:\n${services}\n` +
        `─────────────────────\n` +
        `Total: $${inv.total.toFixed(2)} ${inv.currency}\n` +
        (inv.notes ? `\nNotes: ${inv.notes}` : ''),
    });
  };

  // ── Header ──
  const Header = ({ title, right }: { title: string; right?: React.ReactNode }) => (
    <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: card }]}>
      <TouchableOpacity onPress={view === 'list' ? onBack : () => { resetForm(); setView('list'); }} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: text }]}>{title}</Text>
      {right ?? <View style={{ width: 40 }} />}
    </View>
  );

  // ── Invoice List ──
  if (view === 'list') {
    return (
      <View style={[styles.root, { backgroundColor: bg }]}>
        <Header
          title="Invoices"
          right={
            <TouchableOpacity onPress={() => setView('create')} style={styles.addBtn}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          }
        />
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={TEAL} size="large" /></View>
        ) : invoices.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="document-text-outline" size={56} color={TEAL} />
            <Text style={[styles.emptyTitle, { color: text }]}>No invoices yet</Text>
            <Text style={[styles.emptySub, { color: muted }]}>Tap + to create your first invoice</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {invoices.map(inv => (
              <TouchableOpacity
                key={inv.id}
                style={[styles.invCard, { backgroundColor: card }]}
                onPress={() => { setSelected(inv); setView('detail'); }}
                activeOpacity={0.8}
              >
                <View style={styles.invCardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.invNum, { color: text }]}>{inv.invoiceNumber}</Text>
                    <Text style={[styles.invClient, { color: muted }]}>{inv.clientName}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.invTotal, { color: text }]}>${inv.total.toFixed(2)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[inv.status] + '20' }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLOR[inv.status] }]}>{inv.status}</Text>
                    </View>
                  </View>
                </View>
                {inv.dueDate && (
                  <Text style={[styles.invDue, { color: muted }]}>Due: {inv.dueDate}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // ── Create Form ──
  if (view === 'create') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.root, { backgroundColor: bg }]}>
          <Header title="New Invoice" />
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={[styles.sectionLabel, { color: muted }]}>CLIENT</Text>
            <View style={[styles.inputCard, { backgroundColor: card }]}>
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={16} color={muted} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: text }]}
                  placeholder="Client name *"
                  placeholderTextColor={muted}
                  value={clientName}
                  onChangeText={setClientName}
                />
              </View>
              <View style={[styles.inputRow, styles.inputBorder]}>
                <Ionicons name="mail-outline" size={16} color={muted} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: text }]}
                  placeholder="Client email (optional)"
                  placeholderTextColor={muted}
                  value={clientEmail}
                  onChangeText={setClientEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={[styles.inputRow, styles.inputBorder]}>
                <Ionicons name="calendar-outline" size={16} color={muted} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: text }]}
                  placeholder="Due date (e.g. 2025-07-01)"
                  placeholderTextColor={muted}
                  value={dueDate}
                  onChangeText={setDueDate}
                />
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: muted, marginTop: 20 }]}>SERVICES</Text>
            {lines.map((line, i) => (
              <View key={i} style={[styles.lineCard, { backgroundColor: card }]}>
                <View style={styles.lineHeader}>
                  <Text style={[styles.lineNum, { color: muted }]}>Line {i + 1}</Text>
                  {lines.length > 1 && (
                    <TouchableOpacity onPress={() => removeLine(i)}>
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={[styles.lineDesc, { color: text, borderColor: isDark ? '#2D3F55' : '#E2E8F0', backgroundColor: isDark ? '#0D1B2A' : '#F8FAFC' }]}
                  placeholder="Description *"
                  placeholderTextColor={muted}
                  value={line.description}
                  onChangeText={v => updateLine(i, 'description', v)}
                />
                <View style={styles.lineNums}>
                  <View style={[styles.numInput, { borderColor: isDark ? '#2D3F55' : '#E2E8F0', backgroundColor: isDark ? '#0D1B2A' : '#F8FAFC' }]}>
                    <Text style={[styles.numLabel, { color: muted }]}>Qty</Text>
                    <TextInput
                      style={[styles.numField, { color: text }]}
                      keyboardType="decimal-pad"
                      value={line.quantity.toString()}
                      onChangeText={v => updateLine(i, 'quantity', v)}
                    />
                  </View>
                  <View style={[styles.numInput, { borderColor: isDark ? '#2D3F55' : '#E2E8F0', backgroundColor: isDark ? '#0D1B2A' : '#F8FAFC' }]}>
                    <Text style={[styles.numLabel, { color: muted }]}>Rate $</Text>
                    <TextInput
                      style={[styles.numField, { color: text }]}
                      keyboardType="decimal-pad"
                      value={line.rate.toString()}
                      onChangeText={v => updateLine(i, 'rate', v)}
                    />
                  </View>
                  <View style={[styles.numInput, { borderColor: TEAL, backgroundColor: TEAL + '10' }]}>
                    <Text style={[styles.numLabel, { color: TEAL }]}>Total</Text>
                    <Text style={[styles.numField, { color: TEAL, fontWeight: '700' }]}>${line.amount.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addLineBtn} onPress={addLine} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={18} color={TEAL} />
              <Text style={[styles.addLineTxt, { color: TEAL }]}>Add service line</Text>
            </TouchableOpacity>

            <View style={[styles.totalsCard, { backgroundColor: card }]}>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: muted }]}>Subtotal</Text>
                <Text style={[styles.totalVal, { color: text }]}>${subtotal.toFixed(2)}</Text>
              </View>
              <View style={[styles.totalRow, styles.inputBorder]}>
                <Text style={[styles.totalLabel, { color: text, fontWeight: '700' }]}>Total</Text>
                <Text style={[styles.totalBig, { color: TEAL }]}>${subtotal.toFixed(2)}</Text>
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: muted, marginTop: 20 }]}>NOTES</Text>
            <TextInput
              style={[styles.notesInput, { color: text, backgroundColor: card, borderColor: isDark ? '#2D3F55' : '#E2E8F0' }]}
              placeholder="Additional notes (optional)"
              placeholderTextColor={muted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.createBtn, saving && { opacity: 0.7 }]}
              onPress={handleCreate}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <><Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                   <Text style={styles.createBtnTxt}>Create Invoice</Text></>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Detail View ──
  const inv = selected;
  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <Header
        title={inv.invoiceNumber}
        right={
          <TouchableOpacity onPress={() => handleDelete(inv)} style={{ padding: 8 }}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Status row */}
        <View style={[styles.detailCard, { backgroundColor: card }]}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: muted }]}>Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['DRAFT', 'SENT', 'PAID', 'OVERDUE'] as const).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusBtn, inv.status === s && { backgroundColor: STATUS_COLOR[s] }]}
                    onPress={() => handleStatusChange(inv, s)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.statusBtnTxt, inv.status === s && { color: '#fff' }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Client info */}
        <View style={[styles.detailCard, { backgroundColor: card, marginTop: 12 }]}>
          <Text style={[styles.detailSection, { color: muted }]}>CLIENT</Text>
          <Text style={[styles.detailValue, { color: text }]}>{inv.clientName}</Text>
          {inv.clientEmail && <Text style={[styles.detailSub, { color: muted }]}>{inv.clientEmail}</Text>}
          {inv.dueDate && <Text style={[styles.detailSub, { color: muted, marginTop: 4 }]}>Due: {inv.dueDate}</Text>}
        </View>

        {/* Services */}
        <View style={[styles.detailCard, { backgroundColor: card, marginTop: 12 }]}>
          <Text style={[styles.detailSection, { color: muted }]}>SERVICES</Text>
          {(inv.services as InvoiceLine[]).map((s, i) => (
            <View key={i} style={[styles.serviceRow, i > 0 && styles.inputBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.serviceDesc, { color: text }]}>{s.description}</Text>
                <Text style={[styles.serviceMeta, { color: muted }]}>{s.quantity} × ${s.rate.toFixed(2)}</Text>
              </View>
              <Text style={[styles.serviceAmt, { color: text }]}>${s.amount.toFixed(2)}</Text>
            </View>
          ))}
          <View style={[styles.serviceRow, styles.inputBorder]}>
            <Text style={[styles.serviceDesc, { color: text, fontWeight: '700' }]}>Total</Text>
            <Text style={[styles.serviceAmt, { color: TEAL, fontWeight: '800', fontSize: 16 }]}>${inv.total.toFixed(2)} {inv.currency}</Text>
          </View>
        </View>

        {inv.notes && (
          <View style={[styles.detailCard, { backgroundColor: card, marginTop: 12 }]}>
            <Text style={[styles.detailSection, { color: muted }]}>NOTES</Text>
            <Text style={[styles.detailValue, { color: text }]}>{inv.notes}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare(inv)} activeOpacity={0.85}>
          <Ionicons name="share-outline" size={18} color={TEAL} style={{ marginRight: 8 }} />
          <Text style={styles.shareTxt}>Share Invoice</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptySub: { fontSize: 14, textAlign: 'center' },
  invCard: {
    borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  invCardRow: { flexDirection: 'row', alignItems: 'center' },
  invNum: { fontSize: 15, fontWeight: '700' },
  invClient: { fontSize: 13, marginTop: 2 },
  invTotal: { fontSize: 16, fontWeight: '800' },
  invDue: { fontSize: 12, marginTop: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  inputCard: { borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13 },
  inputBorder: { borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  input: { flex: 1, fontSize: 14 },
  lineCard: { borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  lineNum: { fontSize: 12, fontWeight: '600' },
  lineDesc: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 10 },
  lineNums: { flexDirection: 'row', gap: 8 },
  numInput: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 8, alignItems: 'center' },
  numLabel: { fontSize: 10, fontWeight: '600', marginBottom: 4 },
  numField: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  addLineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, justifyContent: 'center' },
  addLineTxt: { fontSize: 14, fontWeight: '600' },
  totalsCard: { borderRadius: 14, overflow: 'hidden', marginTop: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  totalLabel: { fontSize: 14 },
  totalVal: { fontSize: 14, fontWeight: '600' },
  totalBig: { fontSize: 20, fontWeight: '800' },
  notesInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: TEAL, borderRadius: 14, height: 52, marginTop: 24,
  },
  createBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  detailCard: { borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  detailLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  detailSection: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  detailValue: { fontSize: 16, fontWeight: '700' },
  detailSub: { fontSize: 13, marginTop: 2 },
  statusBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  statusBtnTxt: { fontSize: 12, fontWeight: '700', color: '#64748B', writingDirection: 'ltr' },
  serviceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  serviceDesc: { fontSize: 14, fontWeight: '600' },
  serviceMeta: { fontSize: 12, marginTop: 2 },
  serviceAmt: { fontSize: 14, fontWeight: '700' },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 20, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: TEAL,
  },
  shareTxt: { color: TEAL, fontSize: 15, fontWeight: '700' },
});
