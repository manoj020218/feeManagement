import { useState, useEffect } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { api } from '@/core/services/api';
import { fmtDate } from '@/utils/dateHelpers';
import type { Announcement, AnnType } from '@/core/types';

const TYPE_CONFIG: Record<AnnType, { icon: string; label: string; color: string }> = {
  general:         { icon: '📢', label: 'General',         color: 'var(--accent)' },
  holiday:         { icon: '🎉', label: 'Holiday',         color: 'var(--green)' },
  schedule_change: { icon: '🔄', label: 'Schedule Change', color: 'var(--yellow)' },
  urgent:          { icon: '🚨', label: 'Urgent',          color: 'var(--red)' },
};

interface Props {
  onLoad?: (count: number) => void;
}

export default function Announcements({ onLoad }: Props) {
  const { memberships } = useAppStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const codes = memberships.map(m => m.inviteCode).filter(Boolean);
      if (codes.length === 0) { setLoading(false); onLoad?.(0); return; }
      setLoading(true);
      const data = await api<{ announcements: Announcement[] }>(
        'GET', `/announcements?codes=${codes.join(',')}`
      );
      setLoading(false);
      const list = data?.announcements ?? [];
      setAnnouncements(list);
      onLoad?.(list.length);
    }
    load();
  }, [memberships.length]); // re-fetch when memberships change

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
      <div style={{ fontSize: '1.5rem', marginBottom: 10 }}>⏳</div>
      Loading announcements…
    </div>
  );

  if (announcements.length === 0) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔔</div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>No announcements yet</div>
      <div style={{ fontSize: '.82rem' }}>
        {memberships.length === 0
          ? 'Join an institution to see their announcements'
          : 'Your institutions haven\'t posted any announcements'}
      </div>
    </div>
  );

  return (
    <div style={{ padding: '16px 16px 0' }}>
      {announcements.map(ann => {
        const cfg = TYPE_CONFIG[ann.type] ?? TYPE_CONFIG.general;
        return (
          <div key={ann._id} className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
            {/* Colour strip at top */}
            <div style={{ height: 3, background: cfg.color, borderRadius: '8px 8px 0 0' }}/>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                  background: `${cfg.color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.2rem',
                }}>
                  {cfg.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{
                      fontSize: '.6rem', fontWeight: 800, padding: '2px 7px',
                      borderRadius: 99, background: `${cfg.color}20`, color: cfg.color,
                    }}>
                      {cfg.label.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '.68rem', color: 'var(--muted)' }}>
                      {ann.instName}
                    </span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '.95rem', marginBottom: 6 }}>
                    {ann.title}
                  </div>
                  <div style={{ fontSize: '.82rem', color: 'var(--text)', lineHeight: 1.6 }}>
                    {ann.body}
                  </div>
                  {ann.date && (ann.type === 'holiday' || ann.type === 'schedule_change') && (
                    <div style={{
                      marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: `${cfg.color}12`, border: `1px solid ${cfg.color}30`,
                      borderRadius: 7, padding: '4px 10px',
                    }}>
                      <span style={{ fontSize: '.7rem', color: cfg.color, fontWeight: 700 }}>
                        📅 {fmtDate(ann.date)}
                      </span>
                    </div>
                  )}
                  <div style={{ fontSize: '.68rem', color: 'var(--muted)', marginTop: 8 }}>
                    Posted {new Date(ann.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
