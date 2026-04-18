import { useEffect, useState } from 'react';
import { useAppStore } from '@/core/store/useAppStore';
import { useAuthStore } from '@/core/store/useAuthStore';
import OnboardingFlow from '@/modules/auth/OnboardingFlow';
import AdminLayout from '@/modules/admin/AdminLayout';
import MemberLayout from '@/modules/member/MemberLayout';
import ToastContainer from '@/modules/shared/Toast';

type AppPhase = 'loading' | 'onboarding' | 'app';

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('loading');
  const { user, activeRole, settings, updateSettings, setActiveRole, institutions } = useAppStore();
  const { hydrateFromAPI } = useAuthStore();

  useEffect(() => {
    async function init() {
      // Brief splash delay
      await new Promise(r => setTimeout(r, 400));

      if (!user) {
        setPhase('onboarding');
        return;
      }

      // Init VPS sync start date if first launch
      if (settings.vpsSyncEnabled && !settings.vpsSyncStartDate) {
        updateSettings({ vpsSyncStartDate: new Date().toISOString() });
      }

      // Check if 1-year free has elapsed
      if (settings.vpsSyncStartDate) {
        const days = (Date.now() - new Date(settings.vpsSyncStartDate).getTime()) / 86400000;
        if (days > 365 && settings.vpsSyncEnabled) {
          // Show expiry prompt — handled by VPSSyncExpiryPrompt
          updateSettings({ _showExpiryPrompt: true } as unknown as typeof settings);
        }
      }

      // Hydrate from API in background if VPS sync on
      if (settings.vpsSyncEnabled) {
        hydrateFromAPI().catch(() => {});
      }

      // Set role based on primaryRole
      const primary = user.primaryRole;
      if (primary === 'member' && institutions.length === 0) {
        setActiveRole('member');
      } else if (primary === 'admin' || primary === 'both' || institutions.length > 0) {
        setActiveRole('admin');
      } else {
        setActiveRole(primary === 'member' ? 'member' : 'admin');
      }

      setPhase('app');
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'loading') return (
    <div style={{
      position:'fixed',inset:0,background:'var(--bg)',display:'flex',
      flexDirection:'column',alignItems:'center',justifyContent:'center',
    }}>
      <div style={{fontFamily:'Lora,serif',fontSize:'3rem',fontWeight:600,color:'var(--accent)',letterSpacing:-2}}>
        FeeFlow
      </div>
      <div style={{fontSize:'.7rem',color:'var(--muted)',letterSpacing:3,textTransform:'uppercase',marginTop:8}}>
        by Jenix
      </div>
    </div>
  );

  if (phase === 'onboarding') return (
    <>
      <OnboardingFlow onDone={() => setPhase('app')}/>
      <ToastContainer/>
    </>
  );

  return (
    <>
      {activeRole === 'member' ? <MemberLayout/> : <AdminLayout/>}
      <ToastContainer/>
    </>
  );
}
