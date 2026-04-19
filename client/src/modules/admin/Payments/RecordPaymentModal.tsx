import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { useUIStore } from '@/core/store/useUIStore';
import type { Member, PayMode, Transaction } from '@/core/types';
import {
  FEEFLOW_APP_URL,
  buildReceiptShareText,
  buildSmsShareUrl,
  buildWhatsAppAppUrl,
  buildWhatsAppShareUrl,
} from '@/core/services/shareService';
import { ReceiptData, buildReceiptHTML, generateReceiptImage, shareReceiptAsImage } from '@/core/services/pdfService';
import { th } from '@/data/institutionTypes';
import { formatCurrency } from '@/data/countries';
import { fmtDate, todayISO } from '@/utils/dateHelpers';
import { applyPayment, netDue } from '@/utils/feeRules';

const PAY_MODES: { value: PayMode; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

interface Props {
  instId: string;
  preselectedMember?: Member;
  onClose: () => void;
}

interface ReceiptState {
  data: ReceiptData;
  message: string;
  phone?: string;
}

const EMPTY_ARRAY: Member[] = [];

async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
}

export default function RecordPaymentModal({ instId, preselectedMember, onClose }: Props) {
  const institutions = useAppStore(s => s.institutions);
  const addTransaction = useAppStore(s => s.addTransaction);
  const updateMember = useAppStore(s => s.updateMember);
  const defaultCountry = useAppStore(s => s.defaultCountry);

  const members = useAppStore(s => s.members[instId] ?? EMPTY_ARRAY);
  const allTxns = useAppStore(s => s.transactions[instId] ?? EMPTY_ARRAY);
  const toast = useUIStore(s => s.toast);

  const inst = institutions.find(i => i.id === instId);
  if (!inst) {
    toast('Institution not found', 'err');
    onClose();
    return null;
  }

  const institution = inst;
  const t = th(institution.type);
  const trackBalance = institution.trackBalance !== false;

  const [searchMem, setSearchMem] = useState(preselectedMember?.name ?? '');
  const [pickedMem, setPickedMem] = useState(preselectedMember?.id ?? '');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<PayMode>('cash');
  const [date, setDate] = useState(todayISO());
  const [period, setPeriod] = useState('');
  const [txnId, setTxnId] = useState('');
  const [note, setNote] = useState('');
  const [receiptState, setReceiptState] = useState<ReceiptState | null>(null);
  const [receiptImageUrl, setReceiptImageUrl] = useState('');
  const [isPreparingReceipt, setIsPreparingReceipt] = useState(false);
  const hiddenReceiptRef = useRef<HTMLDivElement>(null);

  const activeMember = useMemo(
    () => preselectedMember ?? members.find(m => m.id === pickedMem) ?? null,
    [members, pickedMem, preselectedMember],
  );

  const filteredMembers = useMemo(
    () =>
      !preselectedMember && searchMem
        ? members.filter(m => m.name.toLowerCase().includes(searchMem.toLowerCase()))
        : [],
    [members, preselectedMember, searchMem],
  );

  const memberBalance = activeMember?.balance ?? 0;
  const memberNetDue = activeMember ? netDue(activeMember) : 0;

  const inpStyle: CSSProperties = {
    width: '100%',
    background: 'var(--s2)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--r2)',
    padding: '10px 13px',
    color: 'var(--text)',
    fontFamily: 'Outfit,sans-serif',
    fontSize: '.88rem',
    outline: 'none',
  };

  useEffect(() => {
    if (!receiptState || !hiddenReceiptRef.current) return;

    let cancelled = false;
    const container = hiddenReceiptRef.current;
    const receiptHtml = buildReceiptHTML(receiptState.data);

    setIsPreparingReceipt(true);
    setReceiptImageUrl('');
    container.innerHTML = receiptHtml;

    const timer = window.setTimeout(async () => {
      try {
        const imageUrl = await generateReceiptImage('receiptContainer');
        if (!cancelled) setReceiptImageUrl(imageUrl);
      } catch {
        if (!cancelled) toast('Receipt preview could not be generated', 'warn');
      } finally {
        if (!cancelled) setIsPreparingReceipt(false);
      }
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [receiptState, toast]);

  function pickMember(member: Member) {
    setPickedMem(member.id);
    setSearchMem(member.name);
    setAmount(String(netDue(member)));
  }

  function closeModal() {
    onClose();
  }

  function handleRecord() {
    const member = activeMember;
    if (!member) {
      toast(`Select a ${t.member.toLowerCase()}`, 'warn');
      return;
    }

    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast('Enter valid amount', 'warn');
      return;
    }

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const receiptNo = 'RCP' + String(allTxns.length + 1).padStart(4, '0');
    const tx: Transaction = {
      id,
      instId,
      memberId: member.id,
      amount: amt,
      mode,
      date,
      period: period.trim() || undefined,
      note: note.trim() || undefined,
      receiptNo,
      txnId: txnId.trim() || undefined,
    };

    addTransaction(tx);

    const { newBalance, newNextDue, newStatus } = applyPayment(member, institution, amt, date);
    updateMember(instId, member.id, {
      status: newStatus,
      nextDue: newNextDue,
      balance: newBalance,
    });

    const overpaid = newBalance > 0;
    const underpaid = newBalance < 0;
    const suffix = overpaid
      ? ` - ${formatCurrency(newBalance, defaultCountry)} advance carried`
      : underpaid
        ? ` - ${formatCurrency(Math.abs(newBalance), defaultCountry)} arrears`
        : '';

    const payModeLabel = PAY_MODES.find(item => item.value === mode)?.label ?? mode;
    const receiptPeriod = period.trim() || 'Current cycle';
    const nextDueLabel = member.freq === 'one-time' ? undefined : fmtDate(newNextDue);
    const shareMessage = buildReceiptShareText({
      institutionName: institution.name,
      memberName: member.name,
      amount: amt,
      period: receiptPeriod,
      receiptNo,
      paidDate: fmtDate(date),
      payMode: payModeLabel,
      nextDue: nextDueLabel,
      inviteCode: institution.isPublished ? institution.inviteCode : undefined,
      appLink: FEEFLOW_APP_URL,
      countryCode: defaultCountry,
    });

    const footerBase = institution.template?.footer?.trim();
    const footer = footerBase
      ? `${footerBase} Track your payments on FeeFlow.`
      : 'Thank you for your payment. Track your payments on FeeFlow.';

    setReceiptState({
      phone: member.phone,
      message: shareMessage,
      data: {
        institution: {
          name: institution.name,
          logo: institution.logo,
          type: t.label,
        },
        member: {
          name: member.name,
          plan: member.plan,
          memberId: member.identifier,
        },
        transaction: {
          amount: amt,
          period: receiptPeriod,
          paidDate: fmtDate(date),
          nextDue: nextDueLabel,
          payMode: payModeLabel,
          receiptNo,
        },
        footer,
      },
    });

    toast(`${receiptNo} recorded${suffix}`, 'ok');
  }

  async function handleWhatsAppShare() {
    if (!receiptState) return;

    const url = buildWhatsAppShareUrl(receiptState.phone, receiptState.message, defaultCountry);
    const nativeUrl = buildWhatsAppAppUrl(receiptState.phone, receiptState.message, defaultCountry);
    if (!url) {
      toast('Add member phone to open WhatsApp directly', 'warn');
      return;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        if (nativeUrl) {
          window.location.href = nativeUrl;
        } else {
          await Browser.open({ url });
        }
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      toast('WhatsApp opened with a ready message. Press Send there.', 'ok');
    } catch {
      toast('Could not open WhatsApp', 'err');
    }
  }

  function handleSmsShare() {
    if (!receiptState) return;

    const url = buildSmsShareUrl(receiptState.phone, receiptState.message, defaultCountry);
    if (!url) {
      toast('Add member phone to open SMS directly', 'warn');
      return;
    }

    window.location.href = url;
    toast('SMS app opened with a ready message.', 'ok');
  }

  async function handleShareReceipt() {
    if (!receiptState) return;
    if (!receiptImageUrl) {
      toast('Receipt is still being prepared', 'warn');
      return;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        await shareReceiptAsImage(receiptImageUrl, receiptState.message);
        return;
      }

      if (navigator.share) {
        const file = await dataUrlToFile(
          receiptImageUrl,
          `receipt_${receiptState.data.transaction.receiptNo}.jpg`,
        );

        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: 'Fee Receipt',
            text: receiptState.message,
            files: [file],
          });
        } else {
          await navigator.share({
            title: 'Fee Receipt',
            text: receiptState.message,
          });
        }
        return;
      }

      handleDownloadReceipt();
      toast('Receipt image downloaded. You can attach it manually.', 'ok');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast('Could not share receipt', 'err');
    }
  }

  function handleDownloadReceipt() {
    if (!receiptState || !receiptImageUrl) {
      toast('Receipt is still being prepared', 'warn');
      return;
    }

    const link = document.createElement('a');
    link.href = receiptImageUrl;
    link.download = `receipt_${receiptState.data.transaction.receiptNo}.jpg`;
    link.click();
  }

  async function handleCopyMessage() {
    if (!receiptState) return;

    try {
      await navigator.clipboard.writeText(receiptState.message);
      toast('Receipt message copied', 'ok');
    } catch {
      toast('Could not copy the message', 'err');
    }
  }

  const actionButtonStyle = (primary: boolean, disabled = false): CSSProperties => ({
    border: 'none',
    borderRadius: 12,
    padding: '12px 14px',
    fontFamily: 'Outfit,sans-serif',
    fontSize: '.82rem',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled
      ? 'var(--s2)'
      : primary
        ? 'linear-gradient(135deg,var(--accent),#0f8bff)'
        : 'var(--s2)',
    color: disabled ? 'var(--muted)' : primary ? '#fff' : 'var(--text)',
    borderWidth: primary ? 0 : 1,
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    opacity: disabled ? 0.6 : 1,
  });

  return (
    <div className="mo open" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="mo-box" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="mo-handle" />
        <div className="mo-title">{receiptState ? 'Receipt Ready' : 'Record Payment'}</div>

        {!receiptState ? (
          <>
            {preselectedMember ? (
              <div className="fld">
                <label>{t.member}</label>
                <div
                  style={{
                    background: 'var(--s2)',
                    border: '1.5px solid var(--accent)',
                    borderRadius: 'var(--r2)',
                    padding: '10px 13px',
                    fontSize: '.88rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{preselectedMember.name}</span>
                  <span style={{ fontSize: '.75rem', color: 'var(--muted)', textAlign: 'right' }}>
                    {preselectedMember.identifier ? `${preselectedMember.identifier} - ` : ''}
                    {preselectedMember.plan}
                  </span>
                </div>
              </div>
            ) : (
              <div className="fld">
                <label>Search {t.member}</label>
                <input
                  value={searchMem}
                  onChange={e => setSearchMem(e.target.value)}
                  placeholder="Type name..."
                  style={inpStyle}
                />
                {filteredMembers.length > 0 && (
                  <div
                    style={{
                      background: 'var(--s2)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      marginTop: 4,
                      maxHeight: 160,
                      overflowY: 'auto',
                    }}
                  >
                    {filteredMembers.map(member => (
                      <div
                        key={member.id}
                        onClick={() => pickMember(member)}
                        style={{
                          padding: '9px 13px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          fontSize: '.85rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <span>{member.name}</span>
                        <span style={{ color: 'var(--muted)', fontSize: '.75rem' }}>
                          {formatCurrency(netDue(member), defaultCountry)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeMember && trackBalance && (
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginBottom: 12,
                  padding: '10px 13px',
                  background: 'var(--s2)',
                  borderRadius: 'var(--r2)',
                  border: '1px solid var(--border)',
                  fontSize: '.78rem',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--muted)', marginBottom: 2 }}>Regular fee</div>
                  <div style={{ fontWeight: 700 }}>{formatCurrency(activeMember.fee, defaultCountry)}</div>
                </div>
                {memberBalance !== 0 && (
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--muted)', marginBottom: 2 }}>
                      {memberBalance > 0 ? 'Advance credit' : 'Arrears'}
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        color: memberBalance > 0 ? 'var(--green)' : 'var(--red)',
                      }}
                    >
                      {memberBalance > 0 ? '+' : '-'}
                      {formatCurrency(Math.abs(memberBalance), defaultCountry)}
                    </div>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--muted)', marginBottom: 2 }}>Net due</div>
                  <div style={{ fontWeight: 800, color: 'var(--accent)' }}>
                    {formatCurrency(memberNetDue, defaultCountry)}
                  </div>
                </div>
              </div>
            )}

            <div className="fld">
              <label>Amount</label>
              <input
                value={amount}
                onChange={e => setAmount(e.target.value)}
                type="number"
                placeholder={activeMember ? String(memberNetDue) : '0'}
                style={inpStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="fld">
                <label>Mode</label>
                <select value={mode} onChange={e => setMode(e.target.value as PayMode)} style={inpStyle}>
                  {PAY_MODES.map(item => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <label>Date</label>
                <input value={date} onChange={e => setDate(e.target.value)} type="date" style={inpStyle} />
              </div>
            </div>

            {mode !== 'cash' && (
              <div className="fld">
                <label>Transaction ID (optional)</label>
                <input
                  value={txnId}
                  onChange={e => setTxnId(e.target.value)}
                  placeholder="UPI ref / cheque no. / transfer ID"
                  style={inpStyle}
                />
              </div>
            )}

            <div className="fld">
              <label>Period (optional)</label>
              <input
                value={period}
                onChange={e => setPeriod(e.target.value)}
                placeholder="e.g. April 2026"
                style={inpStyle}
              />
            </div>

            <div className="fld">
              <label>Note</label>
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Optional"
                style={inpStyle}
              />
            </div>

            <div className="btn-row">
              <button className="btn g" onClick={closeModal}>
                Cancel
              </button>
              <button className="btn p" onClick={handleRecord}>
                Record Payment
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: 12,
                marginBottom: 12,
              }}
            >
              {receiptImageUrl ? (
                <img
                  src={receiptImageUrl}
                  alt="Receipt preview"
                  style={{ width: '100%', borderRadius: 12, display: 'block' }}
                />
              ) : (
                <div
                  style={{
                    minHeight: 320,
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--muted)',
                    fontSize: '.82rem',
                  }}
                >
                  {isPreparingReceipt ? 'Preparing receipt preview...' : 'Receipt preview will appear here.'}
                </div>
              )}
            </div>

            <div
              style={{
                background: 'linear-gradient(135deg,rgba(37,211,102,.12),rgba(15,139,255,.08))',
                border: '1px solid rgba(37,211,102,.2)',
                borderRadius: 14,
                padding: '12px 14px',
                marginBottom: 12,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '.84rem', marginBottom: 4 }}>
                Ready to share with the member
              </div>
              <div style={{ fontSize: '.75rem', color: 'var(--muted)', lineHeight: 1.55 }}>
                WhatsApp and SMS open the member chat with the message ready. You only need to review and
                press Send there.
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 8 }}>
                Member mobile: {receiptState.phone || 'Not saved yet'}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: '.67rem',
                  fontWeight: 700,
                  color: 'var(--muted)',
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Message Preview
              </div>
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  background: 'var(--s2)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '12px 13px',
                  fontSize: '.78rem',
                  lineHeight: 1.6,
                  color: 'var(--text)',
                }}
              >
                {receiptState.message}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <button
                type="button"
                onClick={handleWhatsAppShare}
                disabled={!receiptState.phone}
                style={actionButtonStyle(true, !receiptState.phone)}
              >
                Open WhatsApp
              </button>
              <button
                type="button"
                onClick={handleSmsShare}
                disabled={!receiptState.phone}
                style={actionButtonStyle(false, !receiptState.phone)}
              >
                Open SMS
              </button>
              <button type="button" onClick={handleShareReceipt} style={actionButtonStyle(false)}>
                Share Receipt
              </button>
              <button type="button" onClick={handleCopyMessage} style={actionButtonStyle(false)}>
                Copy Message
              </button>
            </div>

            <div className="btn-row">
              <button className="btn g" onClick={handleDownloadReceipt}>
                Save Image
              </button>
              <button className="btn p" onClick={closeModal}>
                Done
              </button>
            </div>
          </>
        )}
      </div>

      <div
        ref={hiddenReceiptRef}
        style={{
          position: 'fixed',
          left: -9999,
          top: 0,
          width: 420,
          pointerEvents: 'none',
          opacity: 0,
        }}
      />
    </div>
  );
}
