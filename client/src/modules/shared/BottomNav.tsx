interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: string;   // optional red badge e.g. "3"
}

interface BottomNavProps {
  items: NavItem[];
  active: string;
  onSelect: (id: string) => void;
  accentColor?: string;
}

export default function BottomNav({ items, active, onSelect, accentColor = 'var(--accent)' }: BottomNavProps) {
  return (
    <nav className="bottomnav">
      {items.map(item => (
        <button
          key={item.id}
          className={`bn-btn${item.id === active ? ' active' : ''}`}
          onClick={() => onSelect(item.id)}
          style={item.id === active ? { color: accentColor } : undefined}
        >
          <span className="bn-ico" style={{ position: 'relative', display: 'inline-block' }}>
            {item.icon}
            {item.badge && (
              <span style={{
                position: 'absolute', top: -4, right: -6,
                background: 'var(--red)', color: '#fff',
                fontSize: '.55rem', fontWeight: 800,
                padding: '1px 4px', borderRadius: 99,
                lineHeight: 1.4, minWidth: 14, textAlign: 'center',
              }}>{item.badge}</span>
            )}
          </span>
          <span className="bn-lbl">{item.label}</span>
          {item.id === active && (
            <span className="bn-bar" style={{ background: accentColor }} />
          )}
        </button>
      ))}
    </nav>
  );
}
