/* ─── DTC Admin — Customers Module ──────────────────────────────────────────
   · List view  — summary cards, filter, inline search
   · Detail view — full customer page (NO separate route needed):
       Active subscriptions | Subscription history | Refunded
       Full payment record per subscription (method, ref, amount, discount, notes)
       Refund action → removes from revenue
       Edit payment → update method/ref/amount/discount/notes
       Deactivate/Reactivate from detail
   · Revenue: deactivated + refunded tokens excluded from calcRevenue
   · CustomerDropdown — searchable + add-new inline
──────────────────────────────────────────────────────────────────────────── */
'use strict';

const Customers = (() => {

  let _customers = {};
  let _filter    = 'all';
  let _search    = '';
  let _detailId  = null;

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = async () => {
    const d = await api('/admin/customers', { adminKey: Store.adminKey });
    if (d && !d.error) { _customers = d; _renderCurrent(); }
  };

  const _renderCurrent = () => {
    if (_detailId) _renderDetail(_detailId);
    else renderList();
  };

  const setFilter = (f, btn) => {
    _filter = f;
    document.querySelectorAll('#cf .fb').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    if (_detailId) { _detailId = null; _showListView(); }
    renderList();
  };

  const onSearch = (val) => { _search = val; renderList(); };

  // ── View switching ─────────────────────────────────────────────────────────
  const _showListView = () => {
    const lv = document.getElementById('cust-list-view');
    const dv = document.getElementById('cust-detail-view');
    if (lv) lv.style.display = '';
    if (dv) dv.style.display = 'none';
  };
  const _showDetailView = () => {
    const lv = document.getElementById('cust-list-view');
    const dv = document.getElementById('cust-detail-view');
    if (lv) lv.style.display = 'none';
    if (dv) dv.style.display = '';
  };

  // ════════════════════════════════════════════════════════════════
  //  LIST VIEW
  // ════════════════════════════════════════════════════════════════
  const renderList = () => {
    const wrap = document.getElementById('cust-list');
    if (!wrap) return;
    const sym = (Store.settings || {}).currencySymbol || '$';
    const q   = _search.toLowerCase();

    let entries = Object.values(_customers);
    if (q) entries = entries.filter(c => c.name.toLowerCase().includes(q));

    if (_filter !== 'all') {
      entries = entries.filter(c => {
        const active = (c.subscriptions||[]).filter(s => s.approved && !s.deactivated && !s.refunded);
        if (_filter === 'active')   return active.some(s => _daysLeft(s) > 0);
        if (_filter === 'expiring') return active.some(s => { const d = _daysLeft(s); return d >= 0 && d <= 14; });
        if (_filter === 'expired')  return active.some(s => _daysLeft(s) < 0);
        return true;
      });
    }
    entries.sort((a,b) => a.name.localeCompare(b.name));

    if (!entries.length) {
      wrap.innerHTML = `<div class="empty">${q ? 'No customers match.' : 'No customers yet. Generate a link or add a customer manually.'}</div>`;
      return;
    }
    wrap.innerHTML = entries.map(c => _listCard(c, sym)).join('');
  };

  const _listCard = (c, sym) => {
    const subs   = c.subscriptions || [];
    const active = subs.filter(s => s.approved && !s.deactivated && !s.refunded && _daysLeft(s) > 0);
    const totalRevenue = subs.reduce((a,s) => {
      if (!s.approved || s.isFree || s.refunded || s.deactivated) return a;
      return a + (s.paidPrice !== undefined ? s.paidPrice : Math.max(0,(s.price||0)-(s.discount||0)));
    }, 0);

    let cls = 'cust-card';
    const hasExpiring = active.some(s => { const d=_daysLeft(s); return d>=0&&d<=14; });
    const hasExpired  = subs.filter(s=>s.approved&&!s.deactivated&&!s.refunded).some(s=>_daysLeft(s)<0);
    if (hasExpired)   cls += ' expired-sub';
    else if (hasExpiring) cls += ' expiring';

    const pills = active.slice(0,3).map(s =>
      `<span style="background:var(--success-bg);border:1px solid var(--success-border);border-radius:5px;padding:.1rem .45rem;font-size:.65rem;font-weight:600;color:var(--success)">${esc(s.productName||'—')} · ${_daysLeft(s)}d</span>`
    ).join(' ');

    return `
<div class="${cls}" id="cc-${c.id}">
  <div class="cust-top">
    <div style="flex:1;min-width:0">
      <div class="cust-nm">${esc(c.name)}</div>
      <div class="cust-pk" style="margin-top:.2rem">
        ${c.email  ? `<span style="margin-right:.8rem">✉ ${esc(c.email)}</span>`  : ''}
        ${c.wechat ? `<span>💬 ${esc(c.wechat)}</span>` : ''}
        ${!c.email&&!c.wechat ? '<span style="color:var(--muted2)">No contact info</span>' : ''}
      </div>
      ${pills ? `<div style="margin-top:.4rem;display:flex;flex-wrap:wrap;gap:.3rem">${pills}</div>` : ''}
    </div>
    <div style="display:flex;gap:.4rem;flex-shrink:0;flex-wrap:wrap;align-items:flex-start">
      <button class="btn btn-primary btn-sm" onclick="Customers.openDetail('${c.id}')">View Details</button>
      <button class="btn btn-outline btn-sm" onclick="Customers.openEdit('${c.id}')">Edit</button>
    </div>
  </div>
  <div style="display:flex;gap:1.4rem;flex-wrap:wrap;font-size:.72rem;padding-top:.65rem;border-top:1px solid var(--border);margin-top:.5rem;align-items:center">
    <span><strong style="color:var(--text)">${subs.length}</strong> <span style="color:var(--muted)">links</span></span>
    <span><strong style="color:var(--success)">${active.length}</strong> <span style="color:var(--muted)">active</span></span>
    ${totalRevenue>0 ? `<span><strong style="color:var(--blue);font-family:'JetBrains Mono',monospace">${sym}${totalRevenue.toFixed(2)}</strong> <span style="color:var(--muted)">revenue</span></span>` : ''}
    <span style="color:var(--muted)">Since ${_fmtDate(c.createdAt)}</span>
    <span style="margin-left:auto">
      <button class="btn btn-outline btn-sm" style="color:var(--blue);border-color:var(--blue-mid)" onclick="Customers.generateForCustomer('${esc(c.name)}')">+ New Link</button>
    </span>
  </div>
</div>`;
  };

  // ════════════════════════════════════════════════════════════════
  //  DETAIL VIEW
  // ════════════════════════════════════════════════════════════════
  const openDetail = (id) => {
    _detailId = id;
    _showDetailView();
    _renderDetail(id);
  };

  const backToList = () => {
    _detailId = null;
    _showListView();
    renderList();
  };

  const _renderDetail = (id) => {
    const wrap = document.getElementById('cust-detail-view');
    if (!wrap) return;
    const c = _customers[id];
    if (!c) { wrap.innerHTML = '<div class="empty">Customer not found.</div>'; return; }

    const sym  = (Store.settings || {}).currencySymbol || '$';
    const subs = c.subscriptions || [];

    const activeSubs   = subs.filter(s => s.approved && !s.deactivated && !s.refunded && _daysLeft(s) > 0);
    const expiringSubs = activeSubs.filter(s => { const d=_daysLeft(s); return d>=0&&d<=14; });
    const expiredSubs  = subs.filter(s => s.approved && !s.refunded && (_daysLeft(s)<=0 || s.deactivated));
    const refundedSubs = subs.filter(s => s.refunded);
    const pendingSubs  = subs.filter(s => !s.approved && !s.declined && !s.deactivated);
    const declinedSubs = subs.filter(s => s.declined);
    const historySubs  = [...expiredSubs, ...declinedSubs].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

    const totalRevenue  = subs.reduce((a,s)=>{ if(!s.approved||s.isFree||s.refunded||s.deactivated) return a; return a+(s.paidPrice!==undefined?s.paidPrice:Math.max(0,(s.price||0)-(s.discount||0))); },0);
    const totalRefunded = refundedSubs.reduce((a,s)=>a+(s.refundAmount||0),0);
    const totalLinks    = subs.length;

    wrap.innerHTML = `
<!-- Breadcrumb -->
<div style="margin-bottom:1.1rem;display:flex;align-items:center;gap:.7rem;flex-wrap:wrap">
  <button class="btn btn-outline btn-sm" onclick="Customers.backToList()">← All Customers</button>
  <span style="font-size:.73rem;color:var(--muted)">/ ${esc(c.name)}</span>
</div>

<!-- Profile card -->
<div class="card" style="margin-bottom:1rem">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1rem">
    <div>
      <div style="font-size:1.2rem;font-weight:700;color:var(--text);margin-bottom:.25rem">${esc(c.name)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:.9rem;font-size:.78rem;color:var(--muted)">
        ${c.email  ? `<span>Email: <strong style="color:var(--text)">${esc(c.email)}</strong></span>` : ''}
        ${c.wechat ? `<span>WeChat: <strong style="color:var(--text)">${esc(c.wechat)}</strong></span>` : ''}
        <span>Customer since: <strong style="color:var(--text)">${_fmtDate(c.createdAt)}</strong></span>
      </div>
      ${c.notes?`<div style="margin-top:.35rem;font-size:.74rem;color:var(--muted);font-style:italic">${esc(c.notes)}</div>`:''}
    </div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" onclick="Customers.generateForCustomer('${esc(c.name)}')">+ New Link</button>
      <button class="btn btn-outline btn-sm" onclick="Customers.openEdit('${id}')">Edit Profile</button>
      <button class="btn btn-outline btn-sm" style="color:var(--error);border-color:var(--error-border)" onclick="Customers.del('${id}')">Delete</button>
    </div>
  </div>
  <!-- Summary stats -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.6rem">
    ${_stat('Total Links',    totalLinks,      '')}
    ${_stat('Active Now',     activeSubs.length, 'sv-green')}
    ${_stat('Revenue',        sym+totalRevenue.toFixed(2), 'sv-blue')}
    ${totalRefunded>0 ? _stat('Refunded', sym+totalRefunded.toFixed(2), 'sv-red') : ''}
  </div>
</div>

<!-- ── ACTIVE SUBSCRIPTIONS ── -->
<div class="card-title" style="margin-bottom:.6rem">Active Subscriptions <span class="badge" style="background:var(--success-bg);border:1px solid var(--success-border);color:var(--success)">${activeSubs.length}</span></div>
${activeSubs.length ? activeSubs.map(s=>_subCard(s,sym,'active')).join('') : `<div class="empty" style="margin-bottom:1rem">No active subscriptions.</div>`}

<!-- ── PENDING ── -->
${pendingSubs.length ? `
<div class="card-title" style="margin-bottom:.6rem;margin-top:1.2rem">Pending <span class="badge" style="background:#fef9c3;border:1px solid #fde047;color:#854d0e">${pendingSubs.length}</span></div>
${pendingSubs.map(s=>_subCard(s,sym,'pending')).join('')}` : ''}

<!-- ── HISTORY ── -->
<div class="card-title" style="margin-bottom:.6rem;margin-top:1.2rem">Subscription History <span class="badge">${historySubs.length}</span></div>
${historySubs.length ? historySubs.map(s=>_subCard(s,sym,'history')).join('') : `<div class="empty" style="margin-bottom:1rem">No past subscriptions.</div>`}

<!-- ── REFUNDED ── -->
${refundedSubs.length ? `
<div class="card-title" style="margin-bottom:.6rem;margin-top:1.2rem;color:var(--error)">Refunded <span class="badge" style="background:var(--error-bg);border:1px solid var(--error-border);color:var(--error)">${refundedSubs.length}</span></div>
${refundedSubs.map(s=>_subCard(s,sym,'refunded')).join('')}` : ''}
`;
  };

  const _stat = (label, val, cls) => `
<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:.6rem .8rem;text-align:center">
  <div class="stat-val ${cls}" style="font-size:1.15rem">${val}</div>
  <div class="stat-lbl">${label}</div>
</div>`;

  const _subCard = (s, sym, mode) => {
    const dl   = _daysLeft(s);
    const effP = s.paidPrice !== undefined ? s.paidPrice : Math.max(0,(s.price||0)-(s.discount||0));
    const disc = s.discount || 0;
    const methodLabel = {wechat:'WeChat Pay',alipay:'Alipay',bank:'Bank Transfer',cash:'Cash',other:'Other'};

    // Status badge
    let badge = '';
    if (s.refunded)         badge = `<span class="badge" style="background:var(--error-bg);border:1px solid var(--error-border);color:var(--error)">Refunded</span>`;
    else if (s.declined)    badge = `<span class="badge" style="background:var(--error-bg);border:1px solid var(--error-border);color:var(--error)">Declined</span>`;
    else if (s.deactivated) badge = `<span class="badge" style="background:#f3f4f6;border:1px solid #d1d5db;color:#6b7280">Deactivated</span>`;
    else if (!s.approved)   badge = `<span class="badge" style="background:#fef9c3;border:1px solid #fde047;color:#854d0e">${s.used?'Submitted':'Not Opened'}</span>`;
    else if (dl < 0)        badge = `<span class="badge" style="background:var(--error-bg);border:1px solid var(--error-border);color:var(--error)">Expired ${Math.abs(Math.round(dl))}d ago</span>`;
    else if (dl <= 14)      badge = `<span class="badge" style="background:var(--warn-bg);border:1px solid var(--warn-border);color:var(--warn)">Expiring in ${Math.round(dl)}d</span>`;
    else                    badge = `<span class="badge" style="background:var(--success-bg);border:1px solid var(--success-border);color:var(--success)">Active · ${Math.round(dl)}d left</span>`;

    const expiryStr = s.subscriptionExpiresAt
      ? new Date(s.subscriptionExpiresAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
      : '—';

    // Payment record table
    const payRow = (lbl,val,col='var(--text)') => `
<div><div class="cf-lbl">${lbl}</div><div class="cf-val" style="color:${col}">${val}</div></div>`;

    const payment = `
<div style="margin-top:.65rem;padding:.65rem .85rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.35rem .9rem">
  ${payRow('List Price', s.isFree ? 'Free / Gifted' : sym+(s.price||0).toFixed(2))}
  ${disc>0 ? payRow('Discount', `-${sym}${disc.toFixed(2)}${s.discountReason?' ('+esc(s.discountReason)+')':''}`, 'var(--warn)') : ''}
  ${payRow('Amount Paid', s.isFree ? 'Free' : sym+effP.toFixed(2), s.isFree?'var(--muted)':'var(--success)')}
  ${payRow('Payment Method', methodLabel[s.paymentMethod]||s.paymentMethod||'—')}
  ${payRow('Reference', esc(s.paymentRef||'—'))}
  ${payRow('Paid At', _fmtDate(s.paidAt||s.approvedAt))}
  ${s.paymentUpdatedAt ? payRow('Payment Updated', _fmtDate(s.paymentUpdatedAt), 'var(--muted)') : ''}
  ${s.refunded ? payRow('Refund Amount', `-${sym}${(s.refundAmount||0).toFixed(2)}`, 'var(--error)') : ''}
  ${s.refunded ? payRow('Refund Reason', esc(s.refundReason||'—'), 'var(--error)') : ''}
  ${s.refunded ? payRow('Refund Method', methodLabel[s.refundMethod]||s.refundMethod||'—') : ''}
  ${s.refunded ? payRow('Refunded At', _fmtDate(s.refundedAt)) : ''}
  ${s.deactivationReason ? payRow('Deactivation Reason', esc(s.deactivationReason), 'var(--muted)') : ''}
  ${s.adminNotes ? `<div style="grid-column:1/-1">${payRow('Admin Notes', esc(s.adminNotes), 'var(--muted)')}</div>` : ''}
</div>`;

    // Actions
    let actions = '';
    if (mode === 'active' || mode === 'history') {
      actions = `<div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.6rem">
  <button class="btn btn-outline btn-sm" onclick="Customers.openPaymentEdit('${s.token}')">Edit Payment</button>
  ${!s.refunded && s.approved ? `<button class="btn btn-outline btn-sm" style="color:var(--warn);border-color:var(--warn-border)" onclick="Customers.openRefund('${s.token}')">Issue Refund</button>` : ''}
  ${s.deactivated && !s.refunded ? `<button class="btn btn-outline btn-sm" style="color:var(--blue);border-color:var(--blue-mid)" onclick="Customers._reactivate('${s.token}')">Reactivate</button>` : ''}
  ${!s.deactivated && s.approved && !s.refunded ? `<button class="btn btn-outline btn-sm" style="color:var(--error);border-color:var(--error-border)" onclick="Customers._deactivate('${s.token}')">Deactivate</button>` : ''}
  ${s.email && s.approved ? `<button class="btn btn-ghost btn-sm" onclick="Customers.sendReminder('${s.token}','reminder')">Send Reminder</button>` : ''}
</div>`;
    }

    return `
<div style="background:var(--white);border:1px solid var(--border);border-radius:10px;padding:1rem 1.15rem;margin-bottom:.6rem;box-shadow:var(--shadow)">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;flex-wrap:wrap;margin-bottom:.4rem">
    <div>
      <span style="font-size:.9rem;font-weight:700;color:var(--text)">${esc(s.productName||s.productId||'Unknown')}</span>
      <span style="font-size:.76rem;color:var(--muted);margin-left:.45rem">${esc(s.packageType||'')}</span>
    </div>
    <div style="display:flex;gap:.3rem;align-items:center;flex-wrap:wrap">${badge}</div>
  </div>
  <div style="display:flex;gap:1.1rem;flex-wrap:wrap;font-size:.71rem;color:var(--muted)">
    ${s.approved ? `<span>Activated: <strong style="color:var(--text)">${_fmtDate(s.approvedAt)}</strong></span>` : ''}
    ${s.subscriptionExpiresAt ? `<span>Expires: <strong style="color:var(--text)">${expiryStr}</strong></span>` : ''}
    <span>Created: ${_fmtDate(s.createdAt)}</span>
    ${s.deactivatedAt ? `<span>Deactivated: ${_fmtDate(s.deactivatedAt)}</span>` : ''}
  </div>
  ${payment}
  ${actions}
</div>`;
  };

  // ── Quick deactivate/reactivate ────────────────────────────────────────────
  const _deactivate = async (token) => {
    const reason = prompt('Deactivation reason (optional):') || '';
    const d = await api('/admin/deactivate', { adminKey: Store.adminKey, token, reason });
    if (d && d.success) load(); else alert('Failed: '+(d&&d.error||'?'));
  };
  const _reactivate = async (token) => {
    const d = await api('/admin/reactivate', { adminKey: Store.adminKey, token });
    if (d && d.success) load(); else alert('Failed.');
  };

  // ── Refund modal ───────────────────────────────────────────────────────────
  const openRefund = (token) => {
    const t = _findSub(token); if (!t) return;
    const sym  = (Store.settings||{}).currencySymbol||'$';
    const effP = t.paidPrice!==undefined ? t.paidPrice : Math.max(0,(t.price||0)-(t.discount||0));
    document.getElementById('refund-token').value   = token;
    document.getElementById('refund-amount').value  = effP.toFixed(2);
    document.getElementById('refund-reason').value  = '';
    document.getElementById('refund-method').value  = t.paymentMethod||'';
    document.getElementById('refund-product').textContent = `${t.productName||''} — ${t.packageType||''}`;
    document.getElementById('refund-paid').textContent    = `${sym}${effP.toFixed(2)}`;
    document.getElementById('refund-err').textContent = '';
    document.getElementById('refund-modal').classList.add('open');
  };
  const closeRefund = () => document.getElementById('refund-modal').classList.remove('open');
  const confirmRefund = async () => {
    const token  = document.getElementById('refund-token').value;
    const amount = document.getElementById('refund-amount').value;
    const reason = document.getElementById('refund-reason').value.trim();
    const method = document.getElementById('refund-method').value;
    const errEl  = document.getElementById('refund-err');
    errEl.textContent = '';
    if (!reason) { errEl.textContent = 'Reason is required.'; return; }
    const d = await api('/admin/refund', { adminKey: Store.adminKey, token, refundAmount: amount, refundReason: reason, refundMethod: method });
    if (d && d.success) { closeRefund(); load(); Dashboard.reload(); }
    else errEl.textContent = (d&&d.error)||'Refund failed.';
  };

  // ── Payment edit modal ─────────────────────────────────────────────────────
  const openPaymentEdit = (token) => {
    const t = _findSub(token); if (!t) return;
    const effP = t.paidPrice!==undefined ? t.paidPrice : Math.max(0,(t.price||0)-(t.discount||0));
    document.getElementById('pe-token').value      = token;
    document.getElementById('pe-method').value     = t.paymentMethod||'';
    document.getElementById('pe-ref').value        = t.paymentRef||'';
    document.getElementById('pe-price').value      = effP.toFixed(2);
    document.getElementById('pe-discount').value   = (t.discount||0).toFixed(2);
    document.getElementById('pe-disc-reason').value= t.discountReason||'';
    document.getElementById('pe-notes').value      = t.adminNotes||'';
    document.getElementById('pe-err').textContent  = '';
    document.getElementById('pe-modal').classList.add('open');
  };
  const closePaymentEdit = () => document.getElementById('pe-modal').classList.remove('open');
  const confirmPaymentEdit = async () => {
    const token  = document.getElementById('pe-token').value;
    const method = document.getElementById('pe-method').value;
    const ref    = document.getElementById('pe-ref').value.trim();
    const price  = document.getElementById('pe-price').value;
    const disc   = document.getElementById('pe-discount').value;
    const discR  = document.getElementById('pe-disc-reason').value.trim();
    const notes  = document.getElementById('pe-notes').value.trim();
    const errEl  = document.getElementById('pe-err');
    errEl.textContent = '';
    const d = await api('/admin/update-payment', { adminKey: Store.adminKey, token, paymentMethod: method, paymentRef: ref, paidPrice: price, discount: disc, discountReason: discR, notes });
    if (d && d.success) { closePaymentEdit(); load(); Dashboard.reload(); }
    else errEl.textContent = (d&&d.error)||'Update failed.';
  };

  // ── Add/Edit customer modal ────────────────────────────────────────────────
  const openAdd = () => {
    ['cust-modal-id','cust-modal-name','cust-modal-email','cust-modal-wechat','cust-modal-notes'].forEach(id => {
      const el = document.getElementById(id); if(el) el.value='';
    });
    document.getElementById('cust-modal-title').textContent = 'Add Customer';
    document.getElementById('cust-modal-err').textContent = '';
    document.getElementById('cust-modal').classList.add('open');
    setTimeout(()=>document.getElementById('cust-modal-name').focus(),80);
  };
  const openEdit = (id) => {
    const c = _customers[id]; if (!c) return;
    document.getElementById('cust-modal-title').textContent = 'Edit Customer';
    document.getElementById('cust-modal-id').value    = id;
    document.getElementById('cust-modal-name').value  = c.name ||'';
    document.getElementById('cust-modal-email').value = c.email||'';
    document.getElementById('cust-modal-wechat').value= c.wechat||'';
    document.getElementById('cust-modal-notes').value = c.notes||'';
    document.getElementById('cust-modal-err').textContent = '';
    document.getElementById('cust-modal').classList.add('open');
    setTimeout(()=>document.getElementById('cust-modal-name').focus(),80);
  };
  const closeModal = () => document.getElementById('cust-modal').classList.remove('open');
  const saveModal = async () => {
    const id    = document.getElementById('cust-modal-id').value.trim();
    const name  = document.getElementById('cust-modal-name').value.trim();
    const email = document.getElementById('cust-modal-email').value.trim();
    const wechat= document.getElementById('cust-modal-wechat').value.trim();
    const notes = document.getElementById('cust-modal-notes').value.trim();
    const errEl = document.getElementById('cust-modal-err');
    errEl.textContent = '';
    if (!name) { errEl.textContent = 'Name is required.'; return; }
    const d = await api('/admin/customers/save', { adminKey: Store.adminKey, customer: {id:id||undefined,name,email,wechat,notes} });
    if (d && d.success) { closeModal(); load(); CustomerDropdown.refresh(); }
    else errEl.textContent = (d&&d.error)||'Failed to save.';
  };

  const del = async (id) => {
    const c = _customers[id]; if (!c) return;
    if (!confirm(`Remove customer profile for "${c.name}"?\n\nAll their links and tokens are kept — only the profile is deleted.`)) return;
    const d = await api('/admin/customers/delete', { adminKey: Store.adminKey, id });
    if (d && d.success) { if(_detailId===id) backToList(); load(); CustomerDropdown.refresh(); }
    else alert('Failed.');
  };

  const generateForCustomer = (name) => {
    Shell.navigate('dashboard', document.querySelector('.nav-item[onclick*="dashboard"]'));
    setTimeout(()=>{ const el=document.getElementById('cust-name'); if(el){el.value=name;el.focus();} },80);
  };

  const sendReminder = async (token, type) => {
    const d = await api('/admin/send-reminder', { adminKey: Store.adminKey, token, type });
    if (d && d.ok) alert('Reminder sent!');
    else alert('Failed: '+(d&&d.error||'Unknown'));
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const _findSub = (token) => Object.values(_customers).flatMap(c=>c.subscriptions||[]).find(s=>s.token===token);
  const _daysLeft = (s) => {
    if (!s.subscriptionExpiresAt) return Infinity;
    return (new Date(s.subscriptionExpiresAt)-new Date())/(1000*60*60*24);
  };
  const _fmtDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  };

  return {
    load, renderList, setFilter, onSearch,
    openDetail, backToList,
    openAdd, openEdit, closeModal, saveModal, del,
    openRefund, closeRefund, confirmRefund,
    openPaymentEdit, closePaymentEdit, confirmPaymentEdit,
    generateForCustomer, sendReminder,
    _deactivate, _reactivate,
  };
})();

// ─── CustomerDropdown ─────────────────────────────────────────────────────────
const CustomerDropdown = (() => {
  let _names = [];
  let _instances = {};

  const refresh = async () => {
    const d = await api('/admin/customers/names', { adminKey: Store.adminKey });
    if (Array.isArray(d)) _names = d;
  };

  const init = (wrapperId, inputId) => {
    const wrapper = document.getElementById(wrapperId);
    const inputEl = document.getElementById(inputId);
    if (!wrapper || !inputEl) return;
    const listEl = document.createElement('div');
    listEl.className = 'cd-list';
    wrapper.style.position = 'relative';
    wrapper.appendChild(listEl);
    const inst = { wrapper, inputEl, listEl };
    _instances[wrapperId] = inst;
    inputEl.setAttribute('autocomplete','off');
    inputEl.addEventListener('input',  ()=>_show(inst));
    inputEl.addEventListener('focus',  ()=>_show(inst));
    inputEl.addEventListener('keydown',e=>_key(e,inst));
    document.addEventListener('click', e=>{ if(!wrapper.contains(e.target)) _close(inst); });
    if (!_names.length) refresh();
  };

  const _show = (inst) => {
    const q = inst.inputEl.value.toLowerCase();
    const matches = q ? _names.filter(n=>n.toLowerCase().includes(q)) : _names;
    inst.listEl.innerHTML = '';
    const exact = _names.find(n=>n.toLowerCase()===q);
    if (q&&!exact) inst.listEl.appendChild(_row(`Add "${inst.inputEl.value}" as new customer`,inst,inst.inputEl.value,true));
    matches.slice(0,30).forEach(n=>inst.listEl.appendChild(_row(n,inst,n,false)));
    inst.listEl.style.display = (matches.length||(q&&!exact)) ? 'block' : 'none';
  };

  const _row = (label,inst,value,isNew) => {
    const div = document.createElement('div');
    div.className = 'cd-item'+(isNew?' cd-item-new':'');
    div.textContent = label;
    div.addEventListener('mousedown',e=>{
      e.preventDefault();
      inst.inputEl.value = value;
      _close(inst);
      if (isNew && document.getElementById('cust-modal')) {
        document.getElementById('cust-modal-title').textContent='Add Customer';
        ['cust-modal-id','cust-modal-email','cust-modal-wechat','cust-modal-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
        document.getElementById('cust-modal-name').value=value;
        document.getElementById('cust-modal-err').textContent='';
        document.getElementById('cust-modal').classList.add('open');
        setTimeout(()=>document.getElementById('cust-modal-email').focus(),80);
      }
    });
    return div;
  };

  const _close = (inst) => { inst.listEl.style.display='none'; };
  const _key = (e,inst) => {
    const items=inst.listEl.querySelectorAll('.cd-item');
    const active=inst.listEl.querySelector('.cd-item.focused');
    if(e.key==='Escape'){_close(inst);return;}
    if(!items.length)return;
    if(e.key==='ArrowDown'){e.preventDefault();const n=active?(active.nextElementSibling||items[0]):items[0];if(active)active.classList.remove('focused');n.classList.add('focused');return;}
    if(e.key==='ArrowUp'){e.preventDefault();const p=active?(active.previousElementSibling||items[items.length-1]):items[items.length-1];if(active)active.classList.remove('focused');p.classList.add('focused');return;}
    if(e.key==='Enter'&&active){e.preventDefault();active.dispatchEvent(new MouseEvent('mousedown'));}
  };

  return { init, refresh };
})();
