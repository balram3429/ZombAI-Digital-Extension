/* ══════════════════════════════════════════════════════
   ZombAI popup.js  —  v3.0
   Features: IST clock · GitHub user search · repo filter
             profile card · reset · persist state
══════════════════════════════════════════════════════ */

// ── Language colours ──────────────────────────────────
const LANG_COLORS = {
  JavaScript:'#f1e05a', TypeScript:'#3178c6', Python:'#3572A5',
  HTML:'#e34c26', CSS:'#563d7c', Java:'#b07219', Swift:'#F05138',
  Kotlin:'#A97BFF', Ruby:'#701516', Go:'#00ADD8', Rust:'#dea584',
  'C++':'#f34b7d', 'C#':'#178600', Shell:'#89e051',
  'Objective-C':'#438eff', Dart:'#00B4AB', Vue:'#41b883', PHP:'#4F5D95',
};

// ── App state ─────────────────────────────────────────
let allRepos     = [];   // raw non-forked repos from API
let currentUser  = '';
let currentFilter = '';
let profileUrl   = '';

// ── IST Clock ─────────────────────────────────────────
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function pad(n){ return String(n).padStart(2,'0'); }

function tickClock(){
  const now   = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist   = new Date(utcMs + 5.5 * 3600000);

  const timeStr = `${pad(ist.getHours())}:${pad(ist.getMinutes())}:${pad(ist.getSeconds())}`;
  const dateStr = `${DAYS[ist.getDay()]} ${ist.getDate()} ${MONTHS[ist.getMonth()]} ${ist.getFullYear()}`;

  document.getElementById('timeDisplay').textContent = timeStr;
  document.getElementById('timeGhost').textContent   = timeStr;
  document.getElementById('dateDisplay').textContent = dateStr;
}
tickClock();
setInterval(tickClock, 1000);

// ── Tab switching ─────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
  });
});

function switchTab(name){
  document.querySelector(`[data-tab="${name}"]`).click();
}

// ── External link helper ──────────────────────────────
function openTab(url){
  if(typeof chrome !== 'undefined' && chrome.tabs){
    chrome.tabs.create({ url });
  } else {
    window.open(url, '_blank');
  }
}

// ── Explore panel buttons ─────────────────────────────
document.getElementById('exploreBtn').addEventListener('click', () =>
  openTab('https://balram3429.github.io/Xplore-ZombAI/'));

document.getElementById('zombaiReposBtn').addEventListener('click', () => {
  document.getElementById('inputUser').value   = 'balram3429';
  document.getElementById('inputFilter').value = 'zombai';
  switchTab('search');
  doFetch();
});

document.getElementById('ghLink').addEventListener('click', () =>
  openTab('https://github.com/balram3429'));

// ── Input auto-style ─────────────────────────────────
['inputUser','inputFilter'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('input', () =>
    el.classList.toggle('has-value', el.value.trim().length > 0));
  // Enter key triggers fetch
  el.addEventListener('keydown', e => { if(e.key === 'Enter') doFetch(); });
});

// ── Fetch button ──────────────────────────────────────
document.getElementById('btnFetch').addEventListener('click', doFetch);

async function doFetch(){
  const user   = document.getElementById('inputUser').value.trim();
  const filter = document.getElementById('inputFilter').value.trim();

  if(!user){
    shakEl(document.getElementById('inputUser'));
    return;
  }

  currentUser   = user;
  currentFilter = filter;

  const btn = document.getElementById('btnFetch');
  btn.disabled = true;
  btn.textContent = '⏳ Loading…';

  try {
    // Parallel: fetch profile + repos
    const [profileRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${encodeURIComponent(user)}`,
            { headers:{ Accept:'application/vnd.github.v3+json' } }),
      fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=updated`,
            { headers:{ Accept:'application/vnd.github.v3+json' } }),
    ]);

    if(profileRes.status === 404) throw new Error(`User "${user}" not found on GitHub`);
    if(!profileRes.ok) throw new Error(`GitHub API error ${profileRes.status}`);
    if(!reposRes.ok)   throw new Error(`Repos API error ${reposRes.status}`);

    const profile = await profileRes.json();
    const repos   = await reposRes.json();

    // Exclude forks
    let filtered = repos.filter(r => !r.fork);

    // Apply filter pattern if given
    if(filter){
      const lf = filter.toLowerCase();
      filtered = filtered.filter(r => {
        const n = (r.name || '').toLowerCase();
        const d = (r.description || '').toLowerCase();
        const t = (r.topics || []).join(' ').toLowerCase();
        return n.includes(lf) || d.includes(lf) || t.includes(lf);
      });
    }

    allRepos   = filtered;
    profileUrl = profile.html_url;

    renderProfile(profile, filtered.length);
    renderChips(user, filter, filtered.length, repos.filter(r=>!r.fork).length);
    renderRepos(filtered, filter);
    renderFiltersInRepoPanel(filter);

    // Auto-switch to repos tab if we got results
    switchTab('repos');

  } catch(err){
    renderProfileError(err.message);
    renderChips(user, filter, 0, 0);
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Fetch';
  }
}

// ── Reset ─────────────────────────────────────────────
document.getElementById('btnReset').addEventListener('click', doReset);

function doReset(){
  // Clear inputs
  document.getElementById('inputUser').value   = '';
  document.getElementById('inputFilter').value = '';
  document.getElementById('inputUser').classList.remove('has-value');
  document.getElementById('inputFilter').classList.remove('has-value');

  // Clear state
  allRepos      = [];
  currentUser   = '';
  currentFilter = '';
  profileUrl    = '';

  // Hide profile card
  const card = document.getElementById('profileCard');
  card.classList.remove('visible');

  // Clear chips
  document.getElementById('filterChips').innerHTML = '';

  // Reset repo panel to idle state
  document.getElementById('repoList').innerHTML = `
    <div class="state-box">
      <div class="state-icon">🔍</div>
      <div class="state-title">No Search Yet</div>
      <div class="state-sub">Use the Search tab to enter<br>a GitHub username &amp; fetch repos.</div>
    </div>`;
  document.getElementById('repoCount').textContent = '—';
  document.getElementById('repoSearch').value = '';

  // Reset footer link
  document.getElementById('ghLink').textContent = 'github.com/balram3429 ↗';

  switchTab('search');
}

// ── Profile card ──────────────────────────────────────
function renderProfile(p, matchedCount){
  const card = document.getElementById('profileCard');
  card.classList.add('visible');

  // Avatar
  const ph  = document.getElementById('profileAvatarPh');
  const img = document.getElementById('profileAvatar');
  if(p.avatar_url){
    img.src = p.avatar_url;
    img.style.display = 'block';
    ph.style.display  = 'none';
  } else {
    img.style.display = 'none';
    ph.style.display  = 'flex';
  }

  document.getElementById('profileName').textContent  = p.name || p.login;
  document.getElementById('profileLogin').textContent = `@${p.login}`;

  const bio = document.getElementById('profileBio');
  bio.textContent = p.bio ? (p.bio.length > 80 ? p.bio.slice(0,80)+'…' : p.bio) : '';

  const stats = document.getElementById('profileStats');
  stats.innerHTML = [
    p.public_repos != null ? `<div class="pstat">📦 <strong>${p.public_repos}</strong> repos</div>` : '',
    p.followers    != null ? `<div class="pstat">👥 <strong>${p.followers}</strong> followers</div>` : '',
    p.location     ? `<div class="pstat">📍 ${p.location}</div>` : '',
  ].join('');

  // Footer link
  document.getElementById('ghLink').textContent = `github.com/${p.login} ↗`;

  // Profile GitHub link button
  document.getElementById('profileGhBtn').onclick = () => openTab(p.html_url);
}

function renderProfileError(msg){
  const card = document.getElementById('profileCard');
  card.classList.remove('visible');

  // Show error inside repo list
  document.getElementById('repoList').innerHTML = `
    <div class="state-box">
      <div class="state-icon">⚠️</div>
      <div class="state-title">Fetch Failed</div>
      <div class="state-sub">${escHtml(msg)}</div>
      <button class="refresh-btn" id="retryBtn">↻ Retry</button>
    </div>`;
  document.getElementById('repoCount').textContent = 'error';
  document.getElementById('retryBtn')?.addEventListener('click', doFetch);
  switchTab('repos');
}

// ── Chips ─────────────────────────────────────────────
function renderChips(user, filter, matched, total){
  const box = document.getElementById('filterChips');
  const chips = [];
  if(user)   chips.push(`<div class="chip chip-user">👤 ${escHtml(user)}</div>`);
  if(filter) chips.push(`<div class="chip chip-filter">🔎 ${escHtml(filter)}</div>`);
  if(user)   chips.push(`<div class="chip chip-count">⚡ ${matched}${filter ? ' / '+total : ''} repos</div>`);
  box.innerHTML = chips.join('');
}

// ── Repo rendering ────────────────────────────────────
function renderFiltersInRepoPanel(filter){
  const searchEl = document.getElementById('repoSearch');
  if(filter) searchEl.value = filter;
  attachRepoFilters();
}

function timeAgo(dateStr){
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if(d === 0) return 'today';
  if(d === 1) return '1d ago';
  if(d < 30)  return `${d}d ago`;
  if(d < 365) return `${Math.floor(d/30)}mo ago`;
  return `${Math.floor(d/365)}y ago`;
}

function highlightMatch(text, pattern){
  if(!pattern) return escHtml(text);
  const lp = pattern.toLowerCase();
  const li = text.toLowerCase().indexOf(lp);
  if(li === -1) return escHtml(text);
  return escHtml(text.slice(0, li))
       + `<span class="match-hl">${escHtml(text.slice(li, li+pattern.length))}</span>`
       + escHtml(text.slice(li + pattern.length));
}

function repoCardHTML(repo, filterPat){
  const name    = repo.name;
  const desc    = repo.description || 'No description provided.';
  const stars   = repo.stargazers_count || 0;
  const lang    = repo.language;
  const updated = timeAgo(repo.updated_at);
  const url     = repo.html_url;
  const topics  = (repo.topics || []).slice(0, 3);

  const langHTML = lang
    ? `<div class="repo-lang">
         <div class="lang-dot" style="background:${LANG_COLORS[lang]||'#8b8b8b'}"></div>
         <span>${escHtml(lang)}</span>
       </div>` : '';

  const topicsHTML = topics.map(t =>
    `<span class="repo-tag">${escHtml(t)}</span>`).join('');

  const shortDesc = desc.length > 90 ? desc.slice(0,90)+'…' : desc;

  return `
    <a class="repo-card" data-url="${escHtml(url)}" href="${escHtml(url)}">
      <div class="repo-top">
        <div class="repo-name">${highlightMatch(name, filterPat)}</div>
        <div class="repo-stars">★ ${stars}</div>
      </div>
      <div class="repo-desc">${highlightMatch(shortDesc, filterPat)}</div>
      <div class="repo-footer">
        ${langHTML}${topicsHTML}
        <span class="repo-updated">${updated}</span>
      </div>
    </a>`;
}

function renderRepos(repos, filterPat){
  const list  = document.getElementById('repoList');
  const count = document.getElementById('repoCount');

  if(!repos.length){
    list.innerHTML = `
      <div class="state-box">
        <div class="state-icon">🔍</div>
        <div class="state-title">No Matches</div>
        <div class="state-sub">
          ${filterPat
            ? `No non-forked repos match <strong style="color:var(--accent3)">"${escHtml(filterPat)}"</strong><br>Try a different pattern or leave it blank.`
            : 'This user has no public non-forked repos.'}
        </div>
      </div>`;
    count.textContent = '0 repos';
    return;
  }

  count.textContent = `${repos.length} repo${repos.length !== 1 ? 's' : ''}`;
  list.innerHTML = `<div class="repo-list">${repos.map(r => repoCardHTML(r, filterPat)).join('')}</div>`;

  list.querySelectorAll('.repo-card').forEach(card => {
    card.addEventListener('click', e => {
      e.preventDefault();
      openTab(card.dataset.url);
    });
  });
}

// ── Repo panel live filter + sort ─────────────────────
function attachRepoFilters(){
  const searchEl = document.getElementById('repoSearch');
  const sortEl   = document.getElementById('repoSort');

  function applyFilters(){
    const q  = searchEl.value.toLowerCase().trim();
    let res  = allRepos.filter(r =>
      !q
      || r.name.toLowerCase().includes(q)
      || (r.description||'').toLowerCase().includes(q)
      || (r.topics||[]).some(t => t.includes(q))
    );

    const sort = sortEl.value;
    if(sort === 'stars') res.sort((a,b) => b.stargazers_count - a.stargazers_count);
    else if(sort === 'name') res.sort((a,b) => a.name.localeCompare(b.name));

    renderRepos(res, q || currentFilter);
    document.getElementById('repoCount').textContent =
      `${res.length} / ${allRepos.length}`;
  }

  // Remove old listeners by replacing elements
  const newSearch = searchEl.cloneNode(true);
  const newSort   = sortEl.cloneNode(true);
  searchEl.parentNode.replaceChild(newSearch, searchEl);
  sortEl.parentNode.replaceChild(newSort, sortEl);

  newSearch.addEventListener('input',  applyFilters);
  newSort.addEventListener('change', applyFilters);
}

// ── Util ──────────────────────────────────────────────
function escHtml(s){
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function shakEl(el){
  el.style.animation = 'none';
  el.style.borderColor = 'var(--accent2)';
  el.style.boxShadow   = '0 0 0 3px rgba(255,74,110,0.15)';
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.boxShadow   = '';
  }, 1000);
  el.focus();
}

// ── Restore last state from chrome.storage ────────────
if(typeof chrome !== 'undefined' && chrome.storage){
  chrome.storage.local.get(['zombai_user','zombai_filter'], data => {
    if(data.zombai_user){
      document.getElementById('inputUser').value = data.zombai_user;
      document.getElementById('inputUser').classList.add('has-value');
    }
    if(data.zombai_filter){
      document.getElementById('inputFilter').value = data.zombai_filter;
      document.getElementById('inputFilter').classList.add('has-value');
    }
  });
}

// Persist inputs on change
document.getElementById('inputUser').addEventListener('input', e => {
  if(typeof chrome !== 'undefined' && chrome.storage)
    chrome.storage.local.set({ zombai_user: e.target.value });
});
document.getElementById('inputFilter').addEventListener('input', e => {
  if(typeof chrome !== 'undefined' && chrome.storage)
    chrome.storage.local.set({ zombai_filter: e.target.value });
});
