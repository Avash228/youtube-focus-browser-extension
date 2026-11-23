(() => {
  "use strict";
  // YouTube deploys both custom elements and div-based view models, sometimes in the same feed.
  const CARD = "ytd-rich-item-renderer,ytd-video-renderer,ytd-grid-video-renderer,ytd-compact-video-renderer,ytd-playlist-video-renderer,ytd-radio-renderer,ytd-compact-radio-renderer,yt-lockup-view-model,yt-lockup-view-model-wiz,.yt-lockup-view-model,.yt-lockup-view-model-wiz,ytd-rich-grid-media,ytd-reel-item-renderer,yt-shorts-lockup-view-model,ytm-shorts-lockup-view-model";
  const records = new Map();
  const once = new Set();
  let cfg = YTFocus.config(), ready = false, revision = 0, scheduled = false;
  let route = location.href, navigationTime = Date.now(), currentWatch = null, gated = false;
  let host, shadow, badge, drawer, list, count, gate, gateTitle, gateReason, notice;
  let panelOpen = false, lastPanelSignature = "", wasGated = false;
  const text = node => node?.textContent?.replace(/\s+/g, " ").trim() || "";
  const musicMix = href => {
    try { return /^RD/.test(new URL(href, location.origin).searchParams.get("list") || ""); }
    catch { return false; }
  };
  const videoId = href => {
    try {
      const url = new URL(href, location.origin);
      if (!/(^|\.)youtube\.com$/.test(url.hostname)) return "";
      return url.pathname.startsWith("/shorts/") ? `short:${url.pathname.split("/")[2]}` : url.searchParams.get("v") || (musicMix(url.href) ? `mix:${url.searchParams.get("list")}` : "");
    } catch { return ""; }
  };
  function channelFrom(root) {
    const anchors = root ? [...root.querySelectorAll("ytd-channel-name a[href],#channel-name a[href],#owner a[href],a[href^='/@'],a[href^='/channel/'],a[href^='/c/'],a[href^='/user/'],a[href^='https://www.youtube.com/@'],a[href^='https://www.youtube.com/channel/']")] : [];
    const candidates = anchors.filter(anchor => YTFocus.channelKey(anchor.href).startsWith("/"));
    // Avatar links often come first and have no text. Prefer a named metadata link for channel rules.
    const anchor = candidates.find(item => text(item)) || candidates[0];
    const name = text(anchor) || anchor?.getAttribute("aria-label") || text(root?.querySelector("ytd-channel-name,#channel-name,.yt-content-metadata-view-model__metadata-row:first-child"));
    return { channel: name, channelUrl: anchor?.getAttribute("href") || "" };
  }
  function cardData(card) {
    const links = [...card.querySelectorAll("a[href*='watch?'],a[href*='/shorts/'],a[href*='playlist?']")].filter(anchor => videoId(anchor.href));
    const heading = card.querySelector("#video-title,#video-title-link,.yt-lockup-metadata-view-model__title,.yt-lockup-metadata-view-model-wiz__title,h3 a,h3,[role='heading']");
    const link = heading?.closest("a[href]") || heading?.querySelector("a[href]") || links.find(anchor => text(anchor)) || links[0];
    if (!link) return null;
    const id = videoId(link.href);
    if (!id) return null;
    const title = heading?.getAttribute("title") || text(heading) || link.getAttribute("title") || text(link) || link.getAttribute("aria-label") || links.find(anchor => anchor.getAttribute("aria-label"))?.getAttribute("aria-label") || "";
    // Skeleton cards are retried after YouTube populates the title; they aren't classified as unknown.
    // RD URLs also occur on ordinary gameplay videos tagged as music by YouTube.
    // Only a labelled Mix or an actual radio renderer identifies a Mix card.
    const isMix = YTFocus.isMixTitle(title) || card.matches("ytd-radio-renderer,ytd-compact-radio-renderer") && links.some(anchor => musicMix(anchor.href));
    if (!title && !id.startsWith("short:") && !isMix) return { id, title: "", pending: true, ...channelFrom(card), isShort: false };
    return { id, title: title || (isMix ? "Джем YouTube" : "Shorts"), ...channelFrom(card), isShort: id.startsWith("short:"), isMix };
  }
  function watchData() {
    if (location.pathname === "/shorts" || location.pathname.startsWith("/shorts/")) {
      const active = document.querySelector("ytd-reel-video-renderer[is-active]") || document.querySelector("ytd-reel-video-renderer");
      return { id: videoId(location.href) || "short:feed", title: text(active?.querySelector("h2,#video-title")) || "Shorts", ...channelFrom(active), isShort: true };
    }
    if (location.pathname !== "/watch" || Date.now() - navigationTime < 800) return null;
    const id = videoId(location.href);
    if (!id) return null;
    const flexy = document.querySelector("ytd-watch-flexy");
    // SPA navigation can leave the old video's DOM around for a moment. Never classify it as the new video.
    if (flexy?.getAttribute("video-id") && flexy.getAttribute("video-id") !== id) return null;
    const metadata = document.querySelector("ytd-watch-metadata");
    const title = text(metadata?.querySelector("h1")) || text(document.querySelector("#above-the-fold #title h1,#info-contents h1.title"));
    if (!title) return null;
    return { id, title, ...channelFrom(metadata || document.querySelector("#above-the-fold") || flexy), isShort: false, isMix: musicMix(location.href) };
  }
  function evaluate(data) {
    if (data.pending) return { allow: !cfg.enabled || !cfg.strict, category: "pending", reason: "Ожидается название видео" };
    return once.has(data.id) ? { allow: true, category: "once", reason: "Разрешено до обновления страницы" } : YTFocus.classify(data, cfg);
  }
  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value) node.textContent = value;
    return node;
  }
  function button(label, handler, kind = "secondary") {
    const node = element("button", kind, label);
    node.type = "button";
    node.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); handler(); });
    return node;
  }
  function error(message) {
    notice.textContent = message;
    notice.hidden = false;
    setTimeout(() => { notice.hidden = true; }, 5000);
  }
  async function channelRule(data, allow) {
    try { await YTFocusSettings.setChannel(data.channelUrl || data.channel, allow); }
    catch (failure) { error(failure.message || "Не удалось сохранить правило. Обнови вкладку."); }
  }
  function allowOnce(data) { once.add(data.id); lastPanelSignature = ""; schedule(); }
  function makeUI() {
    if (host?.isConnected || !document.body) return;
    host = element("div");
    host.id = "ytfocus-root";
    // Shadow DOM isolates styles from YouTube's changing global theme and component rules.
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
      :host{all:initial;position:fixed;bottom:20px;right:20px;z-index:2147483646;font:14px/1.45 system-ui,sans-serif;color:#edf3ed;color-scheme:dark}
      *{box-sizing:border-box} [hidden]{display:none!important} button{font:inherit;cursor:pointer;border:1px solid #38413a;border-radius:10px;padding:8px 12px;color:#edf3ed;background:#252c27}button:hover{background:#354338}button:focus-visible,a:focus-visible{outline:2px solid #b8ee9d;outline-offset:3px} .primary{background:#b8ee9d;color:#142512;border:0;font-weight:650}.primary:hover{background:#d0fac0}.secondary{font-size:12px}
      #badge{box-shadow:0 4px 24px #0005;border-radius:24px;background:#1b291e;border:1px solid #54704f;font-weight:600}#badge span{color:#b8ee9d}.panel{background:#161d18;border:1px solid #3a493d;border-radius:18px;box-shadow:0 12px 55px #0007;width:min(400px,calc(100vw - 40px));margin-bottom:10px;padding:18px}.head{display:flex;align-items:center;justify-content:space-between;gap:12px}h2{font-size:18px;margin:0}p{margin:10px 0;color:#b3c2b6}#list{max-height:min(55vh,510px);overflow:auto}.item{padding:13px 0;border-top:1px solid #2b382e}.title{font-weight:600;overflow-wrap:anywhere}.reason{font-size:12px;color:#aab9ad;margin:5px 0 9px}.actions{display:flex;gap:7px;flex-wrap:wrap}.close{border:0;background:transparent;font-size:20px;padding:0 6px}.empty{padding:15px 0}#notice{background:#5b3519;padding:10px;border-radius:8px;margin-bottom:10px;max-width:390px}#gate{position:fixed;inset:0;background:#080e0cf0;display:flex;align-items:center;justify-content:center;padding:24px;overflow:auto}#gate .panel{width:480px;max-width:100%;margin:0;padding:28px}#gate h2{font-size:24px}#gateTitle{font-size:16px;color:#e8f0e8;overflow-wrap:anywhere}.kicker{font-size:11px;letter-spacing:2px;color:#b8ee9d;margin-bottom:14px}a{color:#b8ee9d}small{font-size:12px;color:#9db0a1}#gateReason{margin-bottom:20px}
    </style><div id="notice" role="status" hidden></div>
    <section id="gate" role="dialog" aria-modal="true" aria-labelledby="gateHeading" hidden><div class="panel"><div class="kicker">YOUTUBE FOCUS</div><h2 id="gateHeading" tabindex="-1">Оставим место полезному</h2><p id="gateTitle"></p><p id="gateReason"></p><div id="gateActions" class="actions"></div><p><small>Фильтр судит по названию и каналу. Если ошибся, разреши ролик или канал.</small></p></div></section>
    <section id="drawer" class="panel" aria-label="Скрытые видео" hidden><div class="head"><h2>Скрытые видео</h2><button type="button" id="close" class="close" aria-label="Закрыть список">×</button></div><p id="count"></p><div id="list"></div><small>Разрешение ролика действует до обновления вкладки.</small></section><button type="button" id="badge" aria-expanded="false">Focus · <span>0</span> скрыто</button>`;
    badge = shadow.getElementById("badge"); drawer = shadow.getElementById("drawer");
    list = shadow.getElementById("list"); count = shadow.getElementById("count");
    gate = shadow.getElementById("gate"); gateTitle = shadow.getElementById("gateTitle"); gateReason = shadow.getElementById("gateReason"); notice = shadow.getElementById("notice");
    badge.addEventListener("click", () => { panelOpen = !panelOpen; renderPanel(); });
    shadow.getElementById("close").addEventListener("click", () => { panelOpen = false; renderPanel(); badge.focus(); });
    shadow.addEventListener("keydown", event => {
      if (event.key === "Escape" && panelOpen) { panelOpen = false; renderPanel(); badge.focus(); }
      if (event.key === "Tab" && gated) {
        const focusable = [...gate.querySelectorAll("button,a[href]")];
        const index = focusable.indexOf(shadow.activeElement);
        if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)?.focus(); }
        else if (!event.shiftKey && (index < 0 || index === focusable.length - 1)) { event.preventDefault(); focusable[0]?.focus(); }
      }
    });
    document.body.append(host);
  }
  function renderPanel() {
    if (!badge) return;
    host.hidden = !cfg.enabled;
    const hidden = [...records.values()].filter(record => !record.decision.allow);
    badge.querySelector("span").textContent = String(hidden.length);
    badge.setAttribute("aria-expanded", String(panelOpen));
    drawer.hidden = !panelOpen;
    if (!panelOpen) return;
    const signature = hidden.map(record => `${record.data.id}:${record.data.title}:${record.decision.reason}`).join("|");
    if (signature === lastPanelSignature && list.childElementCount) return;
    lastPanelSignature = signature;
    count.textContent = `${hidden.length} карточек скрыто на этой странице${hidden.length > 60 ? ". Показаны первые 60." : "."}`;
    list.replaceChildren();
    if (!hidden.length) list.append(element("p", "empty", "Пока ничего не скрыто. Shorts-полки убираются целиком и в счётчик не входят."));
    for (const record of hidden.slice(0, 60)) {
      const item = element("div", "item");
      item.append(element("div", "title", record.data.title), element("div", "reason", `${record.data.channel ? record.data.channel + " · " : ""}${record.decision.reason}`));
      const actions = element("div", "actions");
      actions.append(button("Показать ролик", () => allowOnce(record.data)));
      if (record.data.channelUrl || record.data.channel) actions.append(button("Разрешить канал", () => channelRule(record.data, true)));
      item.append(actions); list.append(item);
    }
  }
  function decorate(card, data) {
    let control = card.querySelector(":scope > [data-ytfocus-control]");
    if (!data.channel && !data.channelUrl) { control?.remove(); return; }
    if (control) return;
    control = element("button", "", "Скрыть канал");
    control.type = "button";
    control.dataset.ytfocusControl = "true";
    control.title = "Всегда скрывать видео этого канала";
    control.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      const latest = records.get(card)?.data;
      if (latest) channelRule(latest, false);
    });
    card.append(control);
  }
  function pauseMedia() {
    if (!gated) return;
    const selector = location.pathname.startsWith("/shorts") ? "ytd-reel-video-renderer video" : "#movie_player video, ytd-watch-flexy video";
    for (const video of document.querySelectorAll(selector)) video.pause();
  }
  function renderGate() {
    if (!gate) return;
    const decision = currentWatch ? evaluate(currentWatch) : null;
    gated = Boolean(cfg.enabled && cfg.guardWatch && decision && !decision.allow);
    gate.hidden = !gated;
    document.documentElement.dataset.ytfocusGated = String(gated);
    if (gated) {
      pauseMedia();
      const signature = `${currentWatch.id}:${revision}:${decision.reason}:${currentWatch.channelUrl}`;
      if (gate.dataset.signature !== signature) {
        gate.dataset.signature = signature;
        gateTitle.textContent = currentWatch.title;
        gateReason.textContent = decision.reason;
        const actions = shadow.getElementById("gateActions");
        actions.replaceChildren(button("На главную", () => location.assign("https://www.youtube.com/"), "primary"), button("Разрешить ролик", () => allowOnce(currentWatch)));
        if (currentWatch.channelUrl || currentWatch.channel) actions.append(button("Разрешить канал", () => channelRule(currentWatch, true)));
      }
      if (!wasGated) shadow.getElementById("gateHeading").focus();
    } else if (wasGated) {
      // Do not autoplay after an override: the user's next Play click is the consent to resume.
      badge.focus();
    }
    wasGated = gated;
  }
  function scan() {
    scheduled = false;
    if (!ready || !document.body) return;
    if (location.href !== route) {
      route = location.href; navigationTime = Date.now(); currentWatch = null;
      setTimeout(schedule, 850);
    }
    makeUI();
    document.documentElement.dataset.ytfocusEnabled = String(cfg.enabled);
    document.documentElement.dataset.ytfocusShorts = String(cfg.enabled && cfg.hideShorts);
    for (const [card] of records) if (!card.isConnected) records.delete(card);
    for (const card of document.querySelectorAll(CARD)) {
      // The outer renderer owns layout; hiding an inner lockup alone leaves empty grid slots.
      if (card.parentElement?.closest(CARD)) continue;
      if (cfg.enabled && cfg.hideShorts && card.closest("ytd-reel-shelf-renderer,ytd-rich-shelf-renderer[is-shorts]")) {
        records.delete(card); card.removeAttribute("data-ytfocus-hidden");
        card.querySelector(":scope > [data-ytfocus-control]")?.remove(); continue;
      }
      const data = cardData(card);
      if (!data) {
        records.delete(card); card.removeAttribute("data-ytfocus-hidden");
        card.querySelector(":scope > [data-ytfocus-control]")?.remove(); continue;
      }
      if (data.pending) {
        // In strict mode a known video card stays invisible until its title can actually be checked.
        records.delete(card);
        const pending = String(cfg.enabled && cfg.strict);
        if (card.dataset.ytfocusHidden !== pending) card.dataset.ytfocusHidden = pending;
        card.querySelector(":scope > [data-ytfocus-control]")?.remove(); continue;
      }
      const decision = evaluate(data);
      records.set(card, { data, decision });
      const hidden = String(!decision.allow);
      if (card.dataset.ytfocusHidden !== hidden) card.dataset.ytfocusHidden = hidden;
      if (cfg.enabled) decorate(card, data);
      else card.querySelector(":scope > [data-ytfocus-control]")?.remove();
    }
    const latestWatch = watchData();
    // Metadata refreshes for the same video must not briefly dismiss an existing guard.
    currentWatch = latestWatch || (currentWatch?.id === videoId(location.href) ? currentWatch : null);
    renderGate(); renderPanel();
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(scan, 150);
  }
  const observer = new MutationObserver(mutations => {
    if (mutations.some(mutation => {
      if (mutation.target === host || host?.contains(mutation.target)) return false;
      if (mutation.type === "childList" && [...mutation.addedNodes, ...mutation.removedNodes].every(node => node === host || node.nodeType === 1 && node.hasAttribute("data-ytfocus-control"))) return false;
      return true;
    })) schedule();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["href", "title", "aria-label", "video-id", "is-active"] });
  for (const name of ["yt-navigate-start", "yt-navigate-finish"]) {
    document.addEventListener(name, () => { navigationTime = Date.now(); schedule(); setTimeout(schedule, 900); });
  }
  document.addEventListener("yt-page-data-updated", schedule);
  window.addEventListener("popstate", () => { schedule(); setTimeout(schedule, 900); });
  document.addEventListener("play", pauseMedia, true);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const key of YTFocusSettings.keys) if (changes[key]) cfg[key] = changes[key].newValue ?? YTFocus.defaults[key];
    cfg = YTFocus.config(cfg); revision++; lastPanelSignature = ""; schedule();
  });
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== "YTFOCUS_STATUS") return;
    respond({ version: chrome.runtime.getManifest().version, hidden: [...records.values()].filter(record => !record.decision.allow).length, scanned: records.size, current: currentWatch, enabled: cfg.enabled });
  });
  YTFocusSettings.read().then(value => { cfg = value; ready = true; schedule(); setTimeout(schedule, 1000); }).catch(() => { ready = true; schedule(); });
  // A bounded heartbeat recovers cards after silent renderer reuse or lost navigation events.
  setInterval(() => { if (!document.hidden) schedule(); }, 2500);
})();
