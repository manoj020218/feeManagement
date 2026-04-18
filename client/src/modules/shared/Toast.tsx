import { useUIStore } from '@/core/store/useUIStore';
import type { ToastType } from '@/core/store/useUIStore';

const ICONS: Record<ToastType, string> = { ok:'✓', warn:'⚠', err:'✕', info:'ℹ' };
const COLORS: Record<ToastType, string> = {
  ok:   'var(--green)',
  warn: 'var(--yellow)',
  err:  'var(--red)',
  info: 'var(--accent)',
};

export default function ToastContainer() {
  const { toasts, dismissToast } = useUIStore();
  return (
    <div style={{
      position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)',
      display:'flex', flexDirection:'column', gap:8, zIndex:9999,
      pointerEvents:'none', alignItems:'center',
    }}>
      {toasts.map(t => (
        <div key={t.id} onClick={() => dismissToast(t.id)} style={{
          background:'var(--s3)', border:`1px solid ${COLORS[t.type]}`,
          borderRadius:12, padding:'10px 18px', fontSize:'.85rem',
          color:COLORS[t.type], display:'flex', alignItems:'center', gap:8,
          pointerEvents:'all', cursor:'pointer', maxWidth:320,
          boxShadow:'0 4px 20px rgba(0,0,0,.4)',
          animation:'toast-in .25s ease',
        }}>
          <span style={{fontWeight:800}}>{ICONS[t.type]}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
