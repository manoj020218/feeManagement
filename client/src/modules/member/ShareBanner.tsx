import { useState } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { th } from '@/data/institutionTypes';
import QRCodeLib from 'qrcode';

const APP_URL  = 'https://feeflow.iotsoft.in';
const APP_NAME = 'FeeFlow';

function buildShareText(instName?: string): string {
  const inst = instName ? `my ${instName}` : 'my';
  return `💳 I now manage ${inst} fees digitally with ${APP_NAME}! No more paper receipts, no missed due dates. Try it free 👇\n${APP_URL}`;
}

function buildWhatsAppUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
function buildTwitterUrl(text: string) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
function buildFacebookUrl() {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(APP_URL)}`;
}

/**
 * Draw a 1080×1920 share card on a canvas and return a PNG Blob.
 * Story-format (9:16) — perfect for WhatsApp Status, Instagram Stories, Reels thumbnail.
 */
async function generateStoryCard(instName: string, instType: string): Promise<Blob> {
  const W = 1080, H = 1920;
  const t = th(instType);

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── Background ─────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#0a0f1e');
  bgGrad.addColorStop(0.55, '#111827');
  bgGrad.addColorStop(1, '#0a0f1e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Accent glow circle top
  const glowTop = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 700);
  glowTop.addColorStop(0, t.color + '40');
  glowTop.addColorStop(1, 'transparent');
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, W, 900);

  // Accent glow circle bottom
  const glowBot = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, 600);
  glowBot.addColorStop(0, '#4f8eff30');
  glowBot.addColorStop(1, 'transparent');
  ctx.fillStyle = glowBot;
  ctx.fillRect(0, H - 700, W, 700);

  // Subtle grid lines
  ctx.strokeStyle = '#ffffff08';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // ── Institution emoji (large) ───────────────────────────────
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '220px serif';
  ctx.fillText(t.icon, W / 2, 480);

  // ── Headline ────────────────────────────────────────────────
  ctx.font = 'bold 88px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('My fees are', W / 2, 740);

  const grad2 = ctx.createLinearGradient(200, 820, 880, 820);
  grad2.addColorStop(0, '#4f8eff');
  grad2.addColorStop(1, t.color);
  ctx.fillStyle = grad2;
  ctx.font = 'bold 96px sans-serif';
  ctx.fillText('fully digital now!', W / 2, 840);

  // ── Institution name pill ───────────────────────────────────
  const pillW = Math.min(800, instName.length * 44 + 80);
  const pillX = (W - pillW) / 2;
  ctx.fillStyle = t.color + '22';
  _roundRect(ctx, pillX, 910, pillW, 90, 45);
  ctx.fill();
  ctx.strokeStyle = t.color + '55';
  ctx.lineWidth = 2;
  _roundRect(ctx, pillX, 910, pillW, 90, 45);
  ctx.stroke();

  ctx.font = 'bold 52px sans-serif';
  ctx.fillStyle = t.color;
  ctx.fillText(instName, W / 2, 957);

  // ── Divider ─────────────────────────────────────────────────
  ctx.strokeStyle = '#ffffff18';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(120, 1060); ctx.lineTo(960, 1060);
  ctx.stroke();

  // ── Body copy ───────────────────────────────────────────────
  ctx.font = '52px sans-serif';
  ctx.fillStyle = '#ffffffaa';
  const lines = [
    'No more paper receipts.',
    'Track payments, check due dates,',
    'view full history — all on your phone.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, W / 2, 1140 + i * 80));

  // ── Feature chips ───────────────────────────────────────────
  const chips = ['✓ Free to use', '✓ Works offline', '✓ No data shared'];
  chips.forEach((chip, i) => {
    const cx = 180 + i * 260;
    ctx.fillStyle = '#ffffff0d';
    _roundRect(ctx, cx, 1390, 220, 60, 30);
    ctx.fill();
    ctx.font = '36px sans-serif';
    ctx.fillStyle = '#ffffffcc';
    ctx.fillText(chip, cx + 110, 1422);
  });

  // ── FeeFlow brand ───────────────────────────────────────────
  ctx.font = 'bold 130px serif';
  const brandGrad = ctx.createLinearGradient(300, 1540, 780, 1540);
  brandGrad.addColorStop(0, '#4f8eff');
  brandGrad.addColorStop(1, '#a78bfa');
  ctx.fillStyle = brandGrad;
  ctx.fillText(APP_NAME, W / 2, 1560);

  ctx.font = '42px sans-serif';
  ctx.fillStyle = '#ffffff55';
  ctx.fillText('by Jenix', W / 2, 1620);

  // ── Divider ─────────────────────────────────────────────────
  ctx.strokeStyle = '#ffffff18';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(120, 1670); ctx.lineTo(960, 1670);
  ctx.stroke();

  // ── QR code ─────────────────────────────────────────────────
  const qrDataUrl = await QRCodeLib.toDataURL(APP_URL, {
    width: 220, margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
  const qrImg = new Image();
  await new Promise<void>(res => { qrImg.onload = () => res(); qrImg.src = qrDataUrl; });

  // White background for QR
  ctx.fillStyle = '#ffffff';
  _roundRect(ctx, W / 2 - 120, 1720, 240, 240, 16);
  ctx.fill();
  ctx.drawImage(qrImg, W / 2 - 110, 1730, 220, 220);

  // URL below QR
  ctx.font = 'bold 44px sans-serif';
  ctx.fillStyle = '#ffffffcc';
  ctx.fillText(APP_URL.replace('https://', ''), W / 2, 2000);

  return new Promise(res => canvas.toBlob(blob => res(blob!), 'image/png', 0.95));
}

function _roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

interface Props {
  /** Compact mode: show just one share row (for Profile page) */
  compact?: boolean;
}

export default function ShareBanner({ compact = false }: Props) {
  const memberships = useAppStore(s => s.memberships);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Pick first membership for personalisation, fallback to generic
  const ms = memberships[0];
  const shareText = buildShareText(ms?.instName);

  async function handleNativeShare() {
    setGenerating(true);
    try {
      const instName = ms?.instName ?? 'my institution';
      const instType = ms?.instType ?? 'other';

      if (navigator.share) {
        // Try with image (WhatsApp Status, Instagram Stories)
        try {
          const blob = await generateStoryCard(instName, instType);
          const file = new File([blob], 'feeflow-share.png', { type: 'image/png' });
          await navigator.share({
            title: `${APP_NAME} — Digital Fee Tracker`,
            text: shareText,
            url: APP_URL,
            files: navigator.canShare?.({ files: [file] }) ? [file] : undefined,
          });
        } catch {
          // files not supported — share text only
          await navigator.share({ title: APP_NAME, text: shareText, url: APP_URL });
        }
      } else {
        // Desktop: download the image
        const blob = await generateStoryCard(instName, instType);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'feeflow-share-card.png';
        a.click();
      }
    } catch (e) {
      // user cancelled — ignore
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownloadCard() {
    setGenerating(true);
    try {
      const blob = await generateStoryCard(ms?.instName ?? 'FeeFlow', ms?.instType ?? 'other');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'feeflow-story-card.png';
      a.click();
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(`${shareText}\n${APP_URL}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const btnBase: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
    background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 12,
    padding: '12px 8px', cursor: 'pointer', fontFamily: 'Outfit,sans-serif',
    flex: 1, minWidth: 0,
  };

  if (compact) {
    // One-row compact version for Profile tab
    return (
      <div style={{ padding: '12px 16px' }}>
        <div style={{
          background: 'linear-gradient(135deg,rgba(79,142,255,.12),rgba(167,139,250,.08))',
          border: '1px solid rgba(79,142,255,.25)', borderRadius: 14, padding: '14px 16px',
        }}>
          <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: 4 }}>
            Share FeeFlow with friends 🚀
          </div>
          <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginBottom: 12 }}>
            Earn good karma — help others go paperless
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleNativeShare} disabled={generating}
              style={{ ...btnBase, background: '#25D366', border: 'none', color: '#fff',
                flexDirection: 'row', gap: 8, padding: '10px 16px', flex: 'none' }}>
              <span style={{ fontSize: '1.1rem' }}>💬</span>
              <span style={{ fontSize: '.78rem', fontWeight: 700 }}>WhatsApp</span>
            </button>
            <a href={buildWhatsAppUrl(shareText)} target="_blank" rel="noreferrer"
              style={{ ...btnBase, background: '#25D366', border: 'none', color: '#fff',
                flexDirection: 'row', gap: 8, padding: '10px 16px', flex: 'none',
                textDecoration: 'none' }}>
              <span style={{ fontSize: '.78rem', fontWeight: 700 }}>wa.me link</span>
            </a>
            <button onClick={handleCopy}
              style={{ ...btnBase, flexDirection: 'row', gap: 8, padding: '10px 16px', flex: 1, color: 'var(--text)' }}>
              <span style={{ fontSize: '1rem' }}>{copied ? '✓' : '📋'}</span>
              <span style={{ fontSize: '.78rem', fontWeight: 700 }}>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 24px' }}>
      <div style={{
        background: 'linear-gradient(135deg,rgba(79,142,255,.1),rgba(167,139,250,.06))',
        border: '1px solid rgba(79,142,255,.2)', borderRadius: 16, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg,rgba(79,142,255,.2),rgba(167,139,250,.15))',
          padding: '18px 18px 14px',
        }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>
            🚀 Spread the word!
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--muted2)', lineHeight: 1.5 }}>
            Help friends &amp; family go paperless. Share FeeFlow and let them track their fees digitally too.
          </div>
        </div>

        {/* Preview message */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>
            Share message preview
          </div>
          <div style={{
            background: 'var(--s2)', borderRadius: 10, padding: '10px 13px',
            fontSize: '.78rem', color: 'var(--text)', lineHeight: 1.6,
            border: '1px solid var(--border)',
          }}>
            {shareText}
          </div>
        </div>

        {/* Share buttons grid */}
        <div style={{ padding: '14px 18px', display: 'flex', gap: 8 }}>
          {/* WhatsApp Status / Native Share — primary CTA */}
          <button onClick={handleNativeShare} disabled={generating}
            style={{
              flex: 1, background: generating ? 'var(--s2)' : 'linear-gradient(135deg,#25D366,#128C7E)',
              border: 'none', borderRadius: 12, color: '#fff',
              padding: '14px 10px', cursor: generating ? 'not-allowed' : 'pointer',
              fontFamily: 'Outfit,sans-serif', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 6,
            }}>
            <span style={{ fontSize: '1.5rem' }}>💬</span>
            <span style={{ fontSize: '.72rem', fontWeight: 800 }}>
              {generating ? 'Generating…' : 'Share + Story Card'}
            </span>
            <span style={{ fontSize: '.62rem', opacity: .8 }}>WhatsApp · Status · Reels</span>
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            {/* Twitter / X */}
            <a href={buildTwitterUrl(shareText)} target="_blank" rel="noreferrer"
              style={{
                ...btnBase, background: '#000', color: '#fff', border: '1px solid #333',
                flexDirection: 'row', gap: 8, padding: '10px 12px', textDecoration: 'none',
              }}>
              <span style={{ fontSize: '1.1rem' }}>𝕏</span>
              <span style={{ fontSize: '.75rem', fontWeight: 700 }}>Twitter / X</span>
            </a>

            {/* Facebook */}
            <a href={buildFacebookUrl()} target="_blank" rel="noreferrer"
              style={{
                ...btnBase, background: '#1877F2', color: '#fff', border: 'none',
                flexDirection: 'row', gap: 8, padding: '10px 12px', textDecoration: 'none',
              }}>
              <span style={{ fontSize: '1.1rem' }}>📘</span>
              <span style={{ fontSize: '.75rem', fontWeight: 700 }}>Facebook</span>
            </a>
          </div>
        </div>

        {/* Secondary row */}
        <div style={{ padding: '0 18px 18px', display: 'flex', gap: 8 }}>
          {/* Download story card */}
          <button onClick={handleDownloadCard} disabled={generating}
            style={{ ...btnBase, color: 'var(--text)', gap: 4 }}>
            <span style={{ fontSize: '1.2rem' }}>🖼️</span>
            <span style={{ fontSize: '.68rem', fontWeight: 700 }}>Story Card</span>
            <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>Save image</span>
          </button>

          {/* WhatsApp direct link */}
          <a href={buildWhatsAppUrl(shareText)} target="_blank" rel="noreferrer"
            style={{ ...btnBase, color: 'var(--text)', textDecoration: 'none', gap: 4 }}>
            <span style={{ fontSize: '1.2rem' }}>📲</span>
            <span style={{ fontSize: '.68rem', fontWeight: 700 }}>WA Link</span>
            <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>Direct chat</span>
          </a>

          {/* SMS */}
          <a href={`sms:?body=${encodeURIComponent(shareText)}`}
            style={{ ...btnBase, color: 'var(--text)', textDecoration: 'none', gap: 4 }}>
            <span style={{ fontSize: '1.2rem' }}>💬</span>
            <span style={{ fontSize: '.68rem', fontWeight: 700 }}>SMS</span>
            <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>Text message</span>
          </a>

          {/* Copy */}
          <button onClick={handleCopy}
            style={{ ...btnBase, color: copied ? 'var(--green)' : 'var(--text)', gap: 4 }}>
            <span style={{ fontSize: '1.2rem' }}>{copied ? '✓' : '📋'}</span>
            <span style={{ fontSize: '.68rem', fontWeight: 700 }}>{copied ? 'Copied!' : 'Copy'}</span>
            <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>Clipboard</span>
          </button>
        </div>

        <div style={{ textAlign: 'center', padding: '0 18px 14px', fontSize: '.65rem', color: 'var(--muted)' }}>
          Story card is 1080×1920 — perfect for WhatsApp Status &amp; Instagram Stories
        </div>
      </div>
    </div>
  );
}
