(() => {
  "use strict";
  const booleanKeys = ["enabled", "strict", "hideShorts", "guardWatch"];
  const listKeys = ["allowChannels", "blockChannels", "allowWords", "blockWords"];
  const keys = [...booleanKeys, ...listKeys];
  async function read() { return YTFocus.config(await chrome.storage.local.get(keys)); }
  async function patch(changes) {
    const clean = YTFocus.config(changes);
    const update = Object.fromEntries(keys.filter(key => Object.hasOwn(changes, key)).map(key => [key, clean[key]]));
    await chrome.storage.local.set(update);
  }
  async function setChannel(identity, allow) {
    const key = YTFocus.channelKey(identity);
    if (!key) throw new Error("Укажи название, @handle или ссылку на канал YouTube.");
    const current = await read();
    const keep = list => list.filter(entry => YTFocus.channelKey(entry) !== key);
    const allowChannels = keep(current.allowChannels), blockChannels = keep(current.blockChannels);
    (allow ? allowChannels : blockChannels).push(key);
    await patch({ allowChannels, blockChannels });
  }
  globalThis.YTFocusSettings = Object.freeze({ read, patch, setChannel, keys });
})();
