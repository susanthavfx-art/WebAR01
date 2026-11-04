import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, LockKeyhole, LogOut, Sparkles, UserRound } from 'lucide-react';
import { Logo } from './UI';
import { clearSession, getProfile, getSession, recordOpen, saveProfile, sendCode, signOut, verifyCode } from '../lib/visitor-auth';

const blank = { full_name: '', title: '', whatsapp: '', age_range: '', relationship: '', child_age_range: '', whatsapp_marketing: false };

export default function VisitorGate({ children }) {
  const [stage, setStage] = useState('loading');
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [profile, setProfile] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const recorded = useRef(false);
  const savedWhatsapp = useRef('');

  async function loadProfile(current) {
    const data = await getProfile(current);
    savedWhatsapp.current = data?.whatsapp || '';
    setProfile(data ? { ...blank, ...data, child_age_range: data.child_age_range || '' } : blank);
    setStage(data ? 'ready' : 'profile');
  }
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const current = await getSession();
        if (!active) return;
        if (!current) { setStage('email'); return; }
        setSession(current);
        const data = await getProfile(current);
        if (!active) return;
        savedWhatsapp.current = data?.whatsapp || '';
        setProfile(data ? { ...blank, ...data, child_age_range: data.child_age_range || '' } : blank);
        setStage(data ? 'ready' : 'profile');
      } catch (e) { if (active) { setError(e.message); setStage('email'); } }
    })();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (stage !== 'ready' || !session || recorded.current) return;
    recorded.current = true;
    const id = new URLSearchParams(window.location.hash.slice(1)).get('p');
    recordOpen(session, id).catch(() => { /* Analytics must not block the viewer. */ });
  }, [stage, session]);
  const run = async (fn) => {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(e.message || 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };
  const field = (name) => ({ value: profile[name], onChange: (e) => setProfile({ ...profile, [name]: e.target.value }) });
  const exit = () => run(async () => { try { await signOut(); } finally { clearSession(); setSession(null); recorded.current = false; setProfile(blank); setStage('email'); } });

  if (stage === 'ready') return <>{children}<button className="visitor-manage" type="button" onClick={() => { setError(''); setStage('profile'); }}><UserRound size={16} /> My details</button></>;
  return <main className="visitor-shell">
    <div className="visitor-orb visitor-orb-one" /><div className="visitor-orb visitor-orb-two" />
    <section className="visitor-card" aria-live="polite">
      <div className="visitor-brand"><Logo full /><span>THE WORLD OF WONDER</span></div>
      {stage === 'loading' ? <p>Getting everything ready…</p> : <>
        <div className="visitor-icon"><Sparkles size={22} /></div>
        {stage === 'email' && <>
          <div className="visitor-kicker">A LITTLE MAGIC AWAITS</div>
          <h1>Welcome to WonderLab.</h1>
          <p className="visitor-lead">Sign in to explore your AR flashcards. We'll email you a one-time code — no password to remember.</p>
          <form onSubmit={(e) => { e.preventDefault(); run(async () => { await sendCode(email.trim()); setStage('code'); setNotice('Check your inbox for your sign-in code.'); }); }}>
            <label>Email address<input type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <button className="visitor-primary" disabled={busy}>{busy ? 'Sending…' : 'Send my code'} <ArrowRight size={17} /></button>
          </form>
        </>}
        {stage === 'code' && <>
          <div className="visitor-kicker">CHECK YOUR INBOX</div><h1>You've got mail.</h1>
          <p className="visitor-lead">Enter the one-time code sent to <strong>{email}</strong>. Check your spam folder too.</p>
          <form onSubmit={(e) => { e.preventDefault(); run(async () => { const current = await verifyCode(email.trim(), code.trim()); setSession(current); await loadProfile(current); }); }}>
            <label>Email code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" placeholder="Enter your code" value={code} onChange={(e) => setCode(e.target.value)} /></label>
            <button className="visitor-primary" disabled={busy}>{busy ? 'Checking…' : 'Continue'} <ArrowRight size={17} /></button>
          </form>
          <div className="visitor-links"><button disabled={busy} onClick={() => run(async () => { await sendCode(email.trim()); setNotice('A new code has been sent.'); })}>Resend code</button><button onClick={() => { setStage('email'); setError(''); setNotice(''); }}>Change email</button></div>
        </>}
        {stage === 'profile' && <>
          <div className="visitor-kicker">LET'S GET TO KNOW YOU</div><h1>A little about you.</h1>
          <p className="visitor-lead">This form is for adults aged 18 or over. A parent or guardian can sign in for a child. Please don't enter a child's name or phone number.</p>
          <form onSubmit={(e) => { e.preventDefault(); run(async () => {
            const current = await getSession(); if (!current) throw new Error('Please sign in again.');
            const whatsapp = profile.whatsapp.replace(/[\s()-]/g, '');
            if (!/^\+[1-9]\d{7,14}$/.test(whatsapp)) throw new Error('Enter a WhatsApp number with country code, for example +94771234567.');
            const { full_name, title, age_range, relationship, child_age_range, whatsapp_marketing } = profile;
            await saveProfile(current, { full_name: full_name.trim(), title, whatsapp, age_range, relationship, child_age_range: child_age_range || null, whatsapp_marketing });
            setSession(current); await loadProfile(current);
          }); }}>
            <div className="visitor-grid">
              <label>Title<select required {...field('title')}><option value="">Choose</option>{['Mr','Mrs','Ms','Dr','Other','Prefer not to say'].map(x => <option key={x}>{x}</option>)}</select></label>
              <label>Full name<input required maxLength={100} autoComplete="name" placeholder="Your name" {...field('full_name')} /></label>
            </div>
            <label>WhatsApp number<input required type="tel" autoComplete="tel" placeholder="+94 77 123 4567" value={profile.whatsapp} onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value, whatsapp_marketing: false })} /><small>Include your country code. This number is not verified.</small></label>
            <div className="visitor-grid">
              <label>Your age range<select required {...field('age_range')}><option value="">Choose</option>{['18-24','25-34','35-44','45-54','55+'].map(x => <option key={x}>{x}</option>)}</select></label>
              <label>I am a…<select required {...field('relationship')}><option value="">Choose</option>{['Parent or guardian','Teacher','Buying for myself','Other'].map(x => <option key={x}>{x}</option>)}</select></label>
            </div>
            <label>Child's age range <span className="visitor-optional">(optional)</span><select {...field('child_age_range')}><option value="">Prefer not to say</option>{['0-2','3-5','6-8','9-12','13-17'].map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="visitor-consent"><input type="checkbox" checked={profile.whatsapp_marketing} disabled={!!savedWhatsapp.current && profile.whatsapp.replace(/[\s()-]/g, '') !== savedWhatsapp.current} onChange={(e) => setProfile({ ...profile, whatsapp_marketing: e.target.checked })} /><span>I'd like to receive WonderLab product news and promotions on WhatsApp. This is optional; I can change my choice here at any time.</span></label>
            {!!savedWhatsapp.current && profile.whatsapp.replace(/[\s()-]/g, '') !== savedWhatsapp.current && <p className="visitor-privacy">Save your new number first, then reopen My details to opt in again.</p>}
            <p className="visitor-privacy"><LockKeyhole size={14} /> Your details and the AR set you open are used for your account and, only if you opt in, WhatsApp promotions. Don't share your sign-in code.</p>
            <button className="visitor-primary" disabled={busy}>{busy ? 'Saving…' : 'Save & explore'} <ArrowRight size={17} /></button>
          </form>
          <div className="visitor-links">{session && <button disabled={busy} onClick={exit}><LogOut size={14} /> Sign out</button>} {profile.user_id && <button onClick={() => setStage('ready')}>Cancel</button>}</div>
        </>}
        {error && <p className="visitor-message visitor-error" role="alert">{error}</p>}
        {notice && <p className="visitor-message" role="status">{notice}</p>}
      </>}
      <div className="visitor-footer"><LockKeyhole size={13} /> MADE FOR CURIOUS LITTLE MINDS</div>
    </section>
  </main>;
}
