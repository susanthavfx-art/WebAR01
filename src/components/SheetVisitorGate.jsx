import React, { useEffect, useState } from 'react';
import { Logo } from './UI';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// This is a visitor information flow, not an access-control boundary. The
// actual paid assets remain public; never use this as a purchase entitlement.
export default function SheetVisitorGate({ children, formUrl, params }) {
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    try {
      const id = params.get('p');
      if (!UUID.test(id || '')) { setStatus('bad-link'); return; }
      const url = new URL(formUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)) throw new Error('Invalid form URL');
      const acceptedKey = `wonderlab.form.accepted.${id}`;
      const pendingKey = `wonderlab.form.pending.${id}`;
      const returned = params.get('visitorComplete');
      if (returned && UUID.test(returned) && returned === sessionStorage.getItem(pendingKey)) {
        sessionStorage.setItem(acceptedKey, '1');
        sessionStorage.removeItem(pendingKey);
        const clean = new URL(window.location.href);
        const hash = new URLSearchParams(clean.hash.slice(1));
        hash.delete('visitorComplete');
        clean.hash = hash.toString();
        window.history.replaceState(null, '', clean.href);
      }
      if (sessionStorage.getItem(acceptedKey) === '1') { setStatus('ready'); return; }
      const state = crypto.randomUUID();
      sessionStorage.setItem(pendingKey, state);
      url.searchParams.set('p', id);
      url.searchParams.set('camera', params.get('camera') === '0' ? '0' : '1');
      url.searchParams.set('state', state);
      window.location.assign(url.href);
    } catch {
      setStatus('error');
    }
  }, [formUrl, params]);
  if (status === 'ready') return children;
  return <main className="library-boot"><Logo full /><p>{status === 'bad-link' ? 'This AR link is incomplete. Please scan the QR again.' : status === 'error' ? 'The visitor form could not be opened. Please allow browser storage and try again.' : 'Opening the visitor form…'}</p></main>;
}
