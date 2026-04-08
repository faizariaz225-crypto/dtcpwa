/* ─── DTC Admin — Modals Module ─────────────────────────────────────────── */

'use strict';

const Modals = (() => {

  // ── Approve modal ──────────────────────────────────────────────────────────
  const openApprove = (token) => {
    const t   = Store.tokens[token];
    if (!t) return;
    const sym = (Store.settings || {}).currencySymbol || '$';
    const effectiveListPrice = t.isFree ? 0 : Math.max(0, (t.price || 0) - (t.discount || 0));
    document.getElementById('approve-token').value          = token;
    document.getElementById('approve-customer').textContent = t.customerName || '—';
    document.getElementById('approve-package').textContent  = t.packageType  || '—';
    document.getElementById('approve-sym').textContent      = sym;
    document.getElementById('approve-list-price').textContent =
      t.isFree ? '🎁 Free / Gifted' : sym + effectiveListPrice.toFixed(2);
    document.getElementById('approve-custom-price').value   = '';
    document.getElementById('approve-err').classList.remove('show');
    document.getElementById('approve-modal').classList.add('open');
    setTimeout(() => document.getElementById('approve-custom-price').focus(), 100);
  };

  const closeApprove = () => document.getElementById('approve-modal').classList.remove('open');

  const confirmApprove = async () => {
    const token       = document.getElementById('approve-token').value;
    const customPrice = document.getElementById('approve-custom-price').value.trim();
    const errEl       = document.getElementById('approve-err');
    errEl.classList.remove('show');

    if (customPrice !== '' && (isNaN(parseFloat(customPrice)) || parseFloat(customPrice) < 0)) {
      errEl.textContent = 'Custom price must be a number ≥ 0.';
      errEl.classList.add('show');
      return;
    }

    const payload = { adminKey: Store.adminKey, token };
    if (customPrice !== '') payload.customPrice = parseFloat(customPrice);

    const d = await api('/admin/approve', payload);
    closeApprove();
    if (d && d.success) Dashboard.reload();
    else alert('Failed to approve.');
  };

  // ── Decline modal ─────────────────────────────────────────────────────────
  const openDecline = (token) => {
    document.getElementById('decline-token').value = token;
    document.getElementById('decline-reason').value =
      'The details provided could not be verified. Please ensure you have entered the correct details and request a new link.';
    document.getElementById('decline-modal').classList.add('open');
  };

  const closeDecline = () => document.getElementById('decline-modal').classList.remove('open');

  const confirmDecline = async () => {
    const token  = document.getElementById('decline-token').value;
    const reason = document.getElementById('decline-reason').value.trim();
    if (!reason) { alert('Please provide a reason.'); return; }
    const d = await api('/admin/decline', { adminKey: Store.adminKey, token, reason });
    closeDecline();
    if (d && d.success) Dashboard.reload();
    else alert('Failed to decline.');
  };

  // ── Session data modal ─────────────────────────────────────────────────────
  const viewSession = (token) => {
    const t = Store.tokens[token];
    if (!t || !t.sessionData) return;
    let display = t.sessionData;
    try { display = JSON.stringify(JSON.parse(t.sessionData), null, 2); } catch {}
    document.getElementById('session-modal-content').value = display;
    document.getElementById('session-modal').classList.add('open');
  };

  const closeSession = () => document.getElementById('session-modal').classList.remove('open');

  const copySession = () => {
    const val = document.getElementById('session-modal-content').value;
    navigator.clipboard.writeText(val).then(() => alert('Session data copied!'));
  };

  // ── Click-outside close on all modals ────────────────────────────────────
  const init = () => {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });
  };

  return { init, openApprove, closeApprove, confirmApprove, openDecline, closeDecline, confirmDecline, viewSession, closeSession, copySession };
})();
