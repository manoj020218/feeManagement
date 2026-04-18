import { useState } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { useUIStore } from '@/core/store/useUIStore';
import { api } from '@/core/services/api';

export default function FeedbackForm() {
  const { memberships } = useAppStore();
  const { toast } = useUIStore();

  const [selCode, setSelCode] = useState(memberships[0]?.inviteCode ?? '');
  const [text,    setText]    = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  const MAX = 300;
  const remaining = MAX - text.length;

  async function send() {
    if (!selCode) { toast('Select an institution', 'warn'); return; }
    if (!text.trim()) { toast('Write your feedback first', 'warn'); return; }
    setSending(true);
    const data = await api('POST', '/feedback', { inviteCode: selCode, text: text.trim() });
    setSending(false);
    if (!data) { toast('Send failed — check connection', 'err'); return; }
    toast('Feedback sent ✓', 'ok');
    setText('');
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  }

  if (memberships.length === 0) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>💬</div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>No institutions joined yet</div>
      <div style={{ fontSize: '.82rem' }}>Join an institution first to send feedback</div>
    </div>
  );

  return (
    <div style={{ padding: '24px 16px' }}>
      <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 4, color: 'var(--member-accent)' }}>
        Send Feedback
      </div>
      <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 20 }}>
        Your feedback goes directly to the institution admin
      </div>

      {/* Institution selector */}
      {memberships.length > 1 && (
        <div className="fld">
          <label>To Institution</label>
          <select value={selCode} onChange={e => setSelCode(e.target.value)} style={{
            width: '100%', background: 'var(--s2)', border: '1.5px solid var(--border)',
            borderRadius: 'var(--r2)', padding: '10px 13px', color: 'var(--text)',
            fontFamily: 'Outfit,sans-serif', fontSize: '.88rem', outline: 'none',
          }}>
            {memberships.map(m => (
              <option key={m.id} value={m.inviteCode}>{m.instName}</option>
            ))}
          </select>
        </div>
      )}

      {memberships.length === 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          padding: '10px 14px', borderRadius: 10, background: 'var(--s2)',
          border: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '1.2rem' }}>🏛️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '.88rem' }}>{memberships[0].instName}</div>
            <div style={{ fontSize: '.7rem', color: 'var(--muted)' }}>Your feedback will go to this institution</div>
          </div>
        </div>
      )}

      {/* Text area */}
      <div className="fld">
        <label>Your Feedback</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value.slice(0, MAX))}
          placeholder="Share your experience, suggestions, or concerns with the admin…"
          rows={5}
          style={{
            width: '100%', background: 'var(--s2)', border: `1.5px solid ${remaining < 20 ? 'var(--yellow)' : 'var(--border)'}`,
            borderRadius: 'var(--r2)', padding: '12px 14px', color: 'var(--text)',
            fontFamily: 'Outfit,sans-serif', fontSize: '.88rem', outline: 'none',
            resize: 'vertical', lineHeight: 1.6,
          }}
        />
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: '.72rem',
        }}>
          <span style={{ color: 'var(--muted)' }}>Be respectful and constructive</span>
          <span style={{ color: remaining < 20 ? 'var(--yellow)' : 'var(--muted)', fontWeight: remaining < 20 ? 700 : 400 }}>
            {remaining} left
          </span>
        </div>
      </div>

      {sent && (
        <div style={{
          padding: '10px 14px', borderRadius: 9, marginBottom: 14,
          background: 'rgba(52,199,89,.1)', border: '1px solid rgba(52,199,89,.25)',
          fontSize: '.82rem', color: 'var(--green)', fontWeight: 600,
        }}>
          ✓ Feedback sent! The admin will review it.
        </div>
      )}

      <button
        className="btn p"
        style={{ width: '100%', background: 'var(--member-accent)' }}
        onClick={send}
        disabled={sending || !text.trim()}
      >
        {sending ? 'Sending…' : '💬 Send Feedback'}
      </button>
    </div>
  );
}
