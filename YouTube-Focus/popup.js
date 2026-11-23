(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  let cfg = YTFocus.config(), current = null, messageTimer;
  function message(value, isError = false) {
    $("message").textContent = value; $("message").className = isError ? "error" : ""; $("message").hidden = false;
    clearTimeout(messageTimer); messageTimer = setTimeout(() => { $("message").hidden = true; }, 3500);
  }
  async function save(changes) {
    try {
      await YTFocusSettings.patch(changes); cfg = await YTFocusSettings.read(); render(); message("Сохранено. Применяется на открытых вкладках.");
    } catch { message("Не удалось сохранить настройки.", true); }
  }
  function renderRules(key) {
    const list = $(key); list.replaceChildren();
    if (!cfg[key].length) { const item = document.createElement("li"); item.className = "empty"; item.textContent = "Список пуст"; list.append(item); }
    for (const entry of cfg[key]) {
      const item = document.createElement("li"), title = document.createElement("span"), remove = document.createElement("button");
      title.textContent = entry; remove.type = "button"; remove.textContent = "×"; remove.setAttribute("aria-label", `Удалить правило ${entry}`);
      remove.addEventListener("click", () => save({ [key]: cfg[key].filter(value => value !== entry) }));
      item.append(title, remove); list.append(item);
    }
    $(key === "allowChannels" ? "allowCount" : "blockCount").textContent = String(cfg[key].length);
  }
  function preview() {
    const title = $("previewTitle").value.trim();
    const decision = YTFocus.classify({ title }, cfg);
    $("previewResult").textContent = title ? `${decision.allow ? "Оставить" : "Скрыть"} · ${decision.reason}` : "Результат появится здесь.";
  }
  function render() {
    for (const key of ["enabled", "hideShorts", "guardWatch"]) $(key).checked = cfg[key];
    document.querySelector(`input[name=strict][value="${cfg.strict}"]`).checked = true;
    $("modeHint").textContent = cfg.strict ? "Строгий режим: оставляем только распознанную музыку, обучение и разрешённые каналы." : "Мягкий режим: явные развлечения скрываем, видео с неопределённой темой оставляем.";
    renderRules("allowChannels"); renderRules("blockChannels"); preview();
  }
  async function refreshStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("No active tab");
      const status = await chrome.tabs.sendMessage(tab.id, { type: "YTFOCUS_STATUS" });
      if (!status) throw new Error("No content script");
      $("hiddenCount").textContent = String(status.hidden);
      $("pageStatus").textContent = status.enabled ? `v${status.version || "1.0.0"} · проверено карточек: ${status.scanned}${status.version !== chrome.runtime.getManifest().version ? " · Обнови вкладку YouTube для новой версии." : ""}` : "Фильтр выключен. Карточки остаются видимыми.";
      current = status.current;
      const hasChannel = Boolean(current && (current.channelUrl || current.channel));
      $("currentChannel").hidden = !hasChannel;
      if (hasChannel) $("currentChannelName").textContent = `Открытый канал: ${current.channel || current.channelUrl}`;
    } catch {
      $("hiddenCount").textContent = "—"; $("pageStatus").textContent = "Открой YouTube. Если он уже открыт — обнови страницу после установки.";
      $("currentChannel").hidden = true;
    }
  }
  async function addChannel(identity, allow) {
    try { await YTFocusSettings.setChannel(identity, allow); cfg = await YTFocusSettings.read(); render(); message("Правило для канала сохранено."); return true; }
    catch (failure) { message(failure.message, true); return false; }
  }
  for (const node of document.querySelectorAll("[data-tab]")) node.addEventListener("click", () => {
    for (const tab of document.querySelectorAll(".tab")) tab.hidden = tab.id !== node.dataset.tab;
    for (const item of document.querySelectorAll("[data-tab]")) item.setAttribute("aria-pressed", String(item === node));
  });
  for (const key of ["enabled", "hideShorts", "guardWatch"]) $(key).addEventListener("change", event => save({ [key]: event.target.checked }));
  for (const node of document.querySelectorAll("input[name=strict]")) node.addEventListener("change", event => save({ strict: event.target.value === "true" }));
  $("channelForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (await addChannel($("channelInput").value, event.submitter?.value !== "block")) $("channelInput").value = "";
  });
  $("allowCurrent").addEventListener("click", () => { if (current) addChannel(current.channelUrl || current.channel, true); });
  $("blockCurrent").addEventListener("click", () => { if (current) addChannel(current.channelUrl || current.channel, false); });
  $("wordsForm").addEventListener("submit", event => {
    event.preventDefault();
    const allowWords = $("allowWords").value.split(/\r?\n/), blockWords = $("blockWords").value.split(/\r?\n/);
    save({ allowWords, blockWords });
  });
  $("previewTitle").addEventListener("input", preview);
  $("export").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: "ytfocus-v1", settings: cfg }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "youtube-focus-settings.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $("import").addEventListener("change", async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 250000) throw new Error("Файл слишком большой.");
      const data = JSON.parse(await file.text());
      if (data.format !== "ytfocus-v1" || !data.settings || typeof data.settings !== "object" || Array.isArray(data.settings)) throw new Error("Это не резервная копия YouTube Focus.");
      const restored = YTFocus.config(data.settings);
      await save(restored); $("allowWords").value = restored.allowWords.join("\n"); $("blockWords").value = restored.blockWords.join("\n");
    } catch (failure) { message(failure.message || "Не удалось прочитать файл.", true); }
    event.target.value = "";
  });
  chrome.storage.onChanged.addListener(async (_changes, area) => {
    if (area !== "local") return;
    cfg = await YTFocusSettings.read(); render(); setTimeout(refreshStatus, 300);
  });
  // Until storage is loaded, keep editing disabled so a default value cannot overwrite a saved one.
  const controls = [...document.querySelectorAll("input,textarea,form button,#export")];
  controls.forEach(node => { node.disabled = true; });
  YTFocusSettings.read().then(value => {
    cfg = value; render(); $("allowWords").value = cfg.allowWords.join("\n"); $("blockWords").value = cfg.blockWords.join("\n");
    controls.forEach(node => { node.disabled = false; });
  }).catch(() => message("Не удалось загрузить настройки. Открой окно заново.", true));
  refreshStatus();
})();
