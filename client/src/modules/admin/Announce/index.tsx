import { useState, useEffect } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { useUIStore } from '@/core/store/useUIStore';
import { api } from '@/core/services/api';
import { fmtDate } from '@/utils/dateHelpers';
import type { Announcement, AnnType } from '@/core/types';

const TYPE_CONFIG: Record<AnnType, { icon: string; label: string; color: string }> = {
  general:         { icon: '📢', label: 'General',         color: 'var(--accent)' },
  holiday:         { icon: '🎉', label: 'Holiday',         color: 'var(--green)' },
  schedule_change: { icon: '🔄', label: 'Schedule Change', color: 'var(--yellow)' },
  urgent:          { icon: '🚨', label: 'Urgent',          color: 'var(--red)' },
};

export default function AdminAnnounce() {
  const { institutions } = useAppStore();
  const { toast } = useUIStore();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [compOpen, setCompOpen] = useState(false);

  // Compose form
  const [selCode,  setSelCode]  = useState(institutions[0]?.inviteCode ?? '');
  const [annType,  setAnnType]  = useState<AnnType>('general');
  const [title,    setTitle]    = useState('');
  const [body,     setBody]     = useState('');
  const [annDate,  setAnnDate]  = useState('');
  const [sending,  setSending]  = useState(false);

  async function load() {
    setLoading(true);
    const data = await api<{ announcements: Announcement[] }>('GET', '/announcements/mine');
    setLoading(false);
    if (data) setAnnouncements(data.announcements);
  }

  useEffect(() => { load(); }, []);

  async function send() {
    if (!selCode) { toast('Select an institution', 'warn'); return; }
    if (!title.trim()) { toast('Enter a title', 'warn'); return; }
    if (!body.trim())  { toast('Enter message body', 'warn'); return; }
    setSending(true);
    const data = await api('POST', '/announcements', {
      inviteCode: selCode,
      type: annType,
      title: title.trim(),
      body: body.trim(),
      date: annDate || undefined,
    });
    setSending(false);
    if (!data) { toast('Failed to send', 'err'); return; }
    toast('Announcement sent to all members ✓', 'ok');
    setCompOpen(false);
    setTitle(''); setBody(''); setAnnDate('');
    load();
  }

  async function deleteAnn(id: string) {
    if (!confirm('Delete this announcement?')) return;
    await api('DELETE', `/announcements/${id}`);
    setAnnouncements(prev => prev.filter(a => a._id !== id));
    toast('Deleted', 'ok');
  }

  const inp: React.CSSProperties = {
    width: '100%', background: 'var(--s2)', border: '1.5px solid var(--border)',
    borderRadius: 'var(--r2)', padding: '10px 13px', color: 'var(--text)',
    fontFamily: 'Outfit,sans-serif', fontSize: '.88rem', outline: 'none',
  };

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem' }}>Announcements</div>
          <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 2 }}>
            Broadcast to all members of your institutions
          </div>
        </div>
        <button className="btn p" style={{ fontSize: '.75rem', padding: '7px 14px' }}
          onClick={() => { setCompOpen(true); setSelCode(institutions[0]?.inviteCode ?? ''); }}>
          + New
        </button>
      </div>

      {/* Feedback section link */}
      <FeedbackSection/>

      {/* Announcements list */}
      {loading && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 24 }}>Loading…</div>}
      {!loading && announcements.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 16px' }}>
          <div style={{ fontSize: '2rem', marginBottom: 10 }}>📢</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>No announcements yet</div>
          <div style={{ fontSize: '.8rem' }}>Tap "+ New" to broadcast to your members</div>
        </div>
      )}
      {announcements.map(ann => {
        const cfg = TYPE_CONFIG[ann.type] ?? TYPE_CONFIG.general;
        return (
          <div key={ann._id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: `${cfg.color}22`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '1.1rem',
              }}>{cfg.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '.9rem' }}>{ann.title}</div>
                <div style={{ fontSize: '.72rem', color: cfg.color, marginTop: 2 }}>
                  {cfg.label} · {ann.instName}
                </div>
                <div style={{ fontSize: '.8rem', color: 'var(--text)', marginTop: 6, lineHeight: 1.5 }}>
                  {ann.body}
                </div>
                <div style={{ fontSize: '.68rem', color: 'var(--muted)', marginTop: 6 }}>
                  {fmtDate(ann.createdAt)}
                </div>
              </div>
              <button onClick={() => deleteAnn(ann._id)} style={{
                background: 'none', border: 'none', color: 'var(--muted)',
                cursor: 'pointer', fontSize: '1rem', padding: '0 4px', flexShrink: 0,
              }}>✕</button>
            </div>
          </div>
        );
      })}

      {/* Compose modal */}
      {compOpen && (
        <div className="mo open" onClick={e => { if (e.target === e.currentTarget) setCompOpen(false); }}>
          <div className="mo-box" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="mo-handle"/>
            <div className="mo-title">New Announcement</div>

            {institutions.length > 1 && (
              <div className="fld">
                <label>Institution</label>
                <select value={selCode} onChange={e => setSelCode(e.target.value)} style={inp}>
                  {institutions.map(i => (
                    <option key={i.id} value={i.inviteCode}>{i.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="fld">
              <label>Type</label>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {(Object.keys(TYPE_CONFIG) as AnnType[]).map(t => {
                  const c = TYPE_CONFIG[t];
                  return (
                    <button key={t} onClick={() => setAnnType(t)} style={{
                      padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                      border: `1.5px solid ${annType === t ? c.color : 'var(--border)'}`,
                      background: annType === t ? `${c.color}18` : 'var(--s2)',
                      color: annType === t ? c.color : 'var(--muted)',
                      fontFamily: 'Outfit,sans-serif', fontSize: '.78rem', fontWeight: 700,
                    }}>
                      {c.icon} {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="fld">
              <label>Title</label>
              <input value={title} onChange={e => setTitle(e.target.value.slice(0, 120))}
                placeholder="e.g. Holiday Notice — Diwali" style={inp}/>
            </div>
            <div className="fld">
              <label>Message</label>
              <textarea value={body} onChange={e => setBody(e.target.value.slice(0, 1000))}
                placeholder="Full announcement details…" rows={4}
                style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}/>
              <div style={{ fontSize: '.68rem', color: 'var(--muted)', textAlign: 'right', marginTop: 4 }}>
                {body.length}/1000
              </div>
            </div>
            {(annType === 'holiday' || annType === 'schedule_change') && (
              <div className="fld">
                <label>Date <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
                <input type="date" value={annDate} onChange={e => setAnnDate(e.target.value)} style={inp}/>
              </div>
            )}

            <div className="btn-row">
              <button className="btn g" onClick={() => setCompOpen(false)}>Cancel</button>
              <button className="btn p" onClick={send} disabled={sending}>
                {sending ? 'Sending…' : '📢 Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Feedback sub-section ─────────────────────────────────
function FeedbackSection() {
  const { institutions } = useAppStore();
  const { toast } = useUIStore();
  const [open,     setOpen]     = useState(false);
  const [selCode,  setSelCode]  = useState('');
  const [feedback, setFeedback] = useState<import('@/core/types').Feedback[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [replyId,  setReplyId]  = useState('');
  const [replyTxt, setReplyTxt] = useState('');

  async function loadFeedback(code: string) {
    if (!code) return;
    setLoading(true);
    const data = await api<{ feedback: import('@/core/types').Feedback[] }>('GET', `/feedback/${code}`);
    setLoading(false);
    if (data) setFeedback(data.feedback);
  }

  function openFeedback() {
    const code = institutions[0]?.inviteCode ?? '';
    setSelCode(code);
    loadFeedback(code);
    setOpen(true);
  }

  async function react(id: string, reaction: string) {
    await api('PUT', `/feedback/${id}/reply`, { reaction });
    setFeedback(prev => prev.map(f => f._id === id ? { ...f, reaction: reaction as import('@/core/types').Reaction } : f));
  }

  async function sendReply(id: string) {
    if (!replyTxt.trim()) return;
    await api('PUT', `/feedback/${id}/reply`, { reply: replyTxt.trim() });
    setFeedback(prev => prev.map(f => f._id === id ? { ...f, reply: replyTxt, repliedAt: new Date().toISOString() } : f));
    toast('Reply sent', 'ok');
    setReplyId('');
    setReplyTxt('');
  }

  const REACTIONS: { key: string; icon: string }[] = [
    { key: 'thumbs_up', icon: '👍' },
    { key: 'heart',     icon: '❤️' },
    { key: 'noted',     icon: '✅' },
  ];

  const inp: React.CSSProperties = {
    width: '100%', background: 'var(--s2)', border: '1.5px solid var(--border)',
    borderRadius: 'var(--r2)', padding: '9px 12px', color: 'var(--text)',
    fontFamily: 'Outfit,sans-serif', fontSize: '.85rem', outline: 'none',
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 14, cursor: 'pointer' }} onClick={openFeedback}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '.9rem' }}>💬 Member Feedback</div>
            <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 2 }}>
              View and respond to feedback from your members
            </div>
          </div>
          <span style={{ color: 'var(--muted)' }}>›</span>
        </div>
      </div>

      {open && (
        <div className="mo open" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="mo-box" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="mo-handle"/>
            <div className="mo-title">💬 Member Feedback</div>

            {institutions.length > 1 && (
              <select value={selCode}
                onChange={e => { setSelCode(e.target.value); loadFeedback(e.target.value); }}
                style={{ ...inp, marginBottom: 14 }}>
                {institutions.map(i => (
                  <option key={i.id} value={i.inviteCode}>{i.name}</option>
                ))}
              </select>
            )}

            {loading && <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>Loading…</div>}
            {!loading && feedback.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0', fontSize: '.82rem' }}>
                No feedback yet
              </div>
            )}

            {feedback.map(fb => (
              <div key={fb._id} style={{
                padding: '12px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: 'var(--s2)',
                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '.85rem', color: 'var(--accent)',
                  }}>
                    {fb.memberName[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '.82rem' }}>
                      {fb.memberName}
                      {fb.memberPhone && (
                        <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>
                          · {fb.memberPhone}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '.8rem', color: 'var(--text)', marginTop: 4, lineHeight: 1.5 }}>
                      {fb.text}
                    </div>
                    <div style={{ fontSize: '.68rem', color: 'var(--muted)', marginTop: 4 }}>
                      {new Date(fb.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {/* Reactions */}
                <div style={{ display: 'flex', gap: 6, marginBottom: fb.reply ? 8 : 0 }}>
                  {REACTIONS.map(r => (
                    <button key={r.key} onClick={() => react(fb._id, fb.reaction === r.key ? 'none' : r.key)}
                      style={{
                        background: fb.reaction === r.key ? 'var(--s2)' : 'transparent',
                        border: `1px solid ${fb.reaction === r.key ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                        fontSize: '.85rem',
                      }}>
                      {r.icon}
                    </button>
                  ))}
                  <button onClick={() => { setReplyId(replyId === fb._id ? '' : fb._id); setReplyTxt(fb.reply ?? ''); }}
                    style={{
                      background: 'transparent', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
                      color: 'var(--accent)', fontSize: '.72rem', fontWeight: 700,
                      fontFamily: 'Outfit,sans-serif',
                    }}>
                    {fb.reply ? 'Edit reply' : 'Reply'}
                  </button>
                </div>

                {/* Existing reply */}
                {fb.reply && replyId !== fb._id && (
                  <div style={{
                    marginTop: 6, padding: '7px 10px', borderRadius: 7,
                    background: 'rgba(79,142,255,.08)', borderLeft: '3px solid var(--accent)',
                    fontSize: '.78rem', color: 'var(--text)',
                  }}>
                    <span style={{ fontSize: '.68rem', color: 'var(--accent)', fontWeight: 700, marginRight: 6 }}>
                      You replied:
                    </span>
                    {fb.reply}
                  </div>
                )}

                {/* Reply input */}
                {replyId === fb._id && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 7 }}>
                    <input value={replyTxt} onChange={e => setReplyTxt(e.target.value.slice(0, 500))}
                      placeholder="Your reply…" style={{ ...inp, flex: 1 }}/>
                    <button className="btn p" style={{ flexShrink: 0, padding: '8px 14px', fontSize: '.78rem' }}
                      onClick={() => sendReply(fb._id)}>Send</button>
                  </div>
                )}
              </div>
            ))}

            <button className="btn g" style={{ marginTop: 12 }} onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
