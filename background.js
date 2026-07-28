const STORAGE_KEY = "leads-tracker-v2";

function loadState() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      try {
        const parsed = JSON.parse(result[STORAGE_KEY] || "{}");
        const groups =
          parsed.groups && typeof parsed.groups === "object"
            ? parsed.groups
            : {};
        if (!groups.Default) groups.Default = [];
        const currentGroup =
          parsed.currentGroup && groups[parsed.currentGroup]
            ? parsed.currentGroup
            : "Default";
        resolve({ groups, currentGroup });
      } catch (e) {
        resolve({ groups: { Default: [] }, currentGroup: "Default" });
      }
    });
  });
}

function saveState(state) {
  const serialized = JSON.stringify(state);
  chrome.storage.local.set({ [STORAGE_KEY]: serialized });
}

function ensureGroup(name, state) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  if (!state.groups[trimmed]) {
    state.groups[trimmed] = [];
  }
  return trimmed;
}

function buildEntry(key, value) {
  const safeKey = (key || "").trim();
  const safeValue = (value || "").trim();
  return {
    key: safeKey || safeValue,
    value: safeValue,
  };
}

function isDuplicateEntry(entry, groupName, state) {
  const items = state.groups[groupName] || [];
  return items.some((item) => {
    const samePair =
      (item.key || "").trim().toLowerCase() ===
        (entry.key || "").trim().toLowerCase() &&
      (item.value || "").trim().toLowerCase() ===
        (entry.value || "").trim().toLowerCase();
    const sameValue =
      (item.value || "").trim().toLowerCase() ===
      (entry.value || "").trim().toLowerCase();
    return samePair || sameValue;
  });
}

function addEntryToGroup(groupName, entry, state) {
  if (isDuplicateEntry(entry, groupName, state)) {
    return { added: false };
  }
  state.groups[groupName].push(entry);
  return { added: true };
}

async function saveCurrentTabFromShortcut() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tabs[0]?.url;
  if (!url) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "Leads Tracker",
      message: "No active tab URL found.",
    });
    return;
  }

  const state = await loadState();
  const group = ensureGroup(state.currentGroup, state);
  if (!group) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "Leads Tracker",
      message: "Please create or select a group first.",
    });
    return;
  }

  const entry = buildEntry("", url);
  const result = addEntryToGroup(group, entry, state);
  if (!result.added) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "Leads Tracker",
      message: `Current tab is already saved in ${group}.`,
    });
    return;
  }

  saveState(state);
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: "Leads Tracker",
    message: `Saved current tab to ${group}.`,
  });
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "save-current-tab") {
    saveCurrentTabFromShortcut();
  }
});
