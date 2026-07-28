const STORAGE_KEY = "leads-tracker-v2";

let state = loadState();
let editingMeta = null;
let searchTerm = "";
let draggedItem = null;

function parseStoredState(raw) {
  try {
    const saved = JSON.parse(raw || "{}");
    const groups =
      saved.groups && typeof saved.groups === "object" ? saved.groups : {};
    if (!groups.Default) groups.Default = [];
    const currentGroup =
      saved.currentGroup && groups[saved.currentGroup]
        ? saved.currentGroup
        : "Default";
    return { groups, currentGroup };
  } catch (e) {
    return { groups: { Default: [] }, currentGroup: "Default" };
  }
}

const groupNameInput = document.getElementById("group-name");
const createGroupBtn = document.getElementById("create-group-btn");
const groupSelect = document.getElementById("group-select");
const groupManagement = document.getElementById("group-management");
const showGroupFormBtn = document.getElementById("show-group-form-btn");
const manageGroupsBtn = document.getElementById("manage-groups-btn");
const groupForm = document.getElementById("group-form");
const showManualFormBtn = document.getElementById("show-manual-form-btn");
const manualForm = document.getElementById("manual-form");

const searchInput = document.getElementById("search-input");

const keyInput = document.getElementById("key-input");
const valueInput = document.getElementById("value-input");
const saveInputBtn = document.getElementById("save-input-btn");
const saveTabBtn = document.getElementById("save-tab-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

const deleteBtn = document.getElementById("delete-btn");
const itemsList = document.getElementById("items-list");
const groupTitle = document.getElementById("group-title");

const exportJsonBtn = document.getElementById("export-json-btn");
const exportCsvBtn = document.getElementById("export-csv-btn");
const importBtn = document.getElementById("import-btn");
const importFileInput = document.getElementById("import-file");
const statusMessage = document.getElementById("status-message");

function loadState() {
  try {
    return parseStoredState(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    return { groups: { Default: [] }, currentGroup: "Default" };
  }
}

function hydrateStateFromStorage() {
  if (chrome?.storage?.local) {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const hydrated = parseStoredState(result[STORAGE_KEY]);
      state = hydrated;
      saveState();
      render();
    });
  }
}

function saveState() {
  const serialized = JSON.stringify(state);
  localStorage.setItem(STORAGE_KEY, serialized);

  if (chrome?.storage?.local) {
    chrome.storage.local.set({ [STORAGE_KEY]: serialized });
  }
}

function ensureGroup(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  if (!state.groups[trimmed]) {
    state.groups[trimmed] = [];
  }
  return trimmed;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function getFaviconUrl(value) {
  if (!isUrl(value)) return "";
  try {
    const url = new URL(value);
    const domain = url.hostname.replace(/^www\./i, "");
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}`;
  } catch {
    return "";
  }
}

function extractKeyFromText(text) {
  const value = (text || "").trim();
  if (!value) return "Untitled";

  if (isUrl(value)) {
    try {
      const parsed = new URL(value);
      return parsed.hostname.replace(/^www\./i, "");
    } catch {}
  }

  const pathMatch = value.match(/\/([a-z0-9._-]+)(?:\/|$)/i);
  if (pathMatch) {
    return pathMatch[1];
  }

  return value;
}

function buildEntry(key, value) {
  const safeKey = (key || "").trim();
  const safeValue = (value || "").trim();

  return {
    key: safeKey || extractKeyFromText(safeValue),
    value: safeValue,
  };
}

function normalizeEntry(entry) {
  return {
    key: (entry.key || "").trim().toLowerCase(),
    value: (entry.value || "").trim().toLowerCase(),
  };
}

function isDuplicateEntry(entry, groupName, ignoreIndex = null) {
  const items = state.groups[groupName] || [];
  const normalized = normalizeEntry(entry);

  return items.some((item, index) => {
    if (ignoreIndex !== null && index === ignoreIndex) return false;

    const normalizedItem = normalizeEntry(item);
    const samePair =
      normalizedItem.key === normalized.key &&
      normalizedItem.value === normalized.value;

    const sameValue = normalizedItem.value === normalized.value;

    return samePair || sameValue;
  });
}

function addEntryToGroup(groupName, entry, options = {}) {
  const items = state.groups[groupName] || [];
  const ignoreIndex = options.ignoreIndex ?? null;

  if (isDuplicateEntry(entry, groupName, ignoreIndex)) {
    return { added: false, duplicate: true };
  }

  items.push(entry);
  state.groups[groupName] = items;
  return { added: true, duplicate: false };
}

function clearInputs() {
  keyInput.value = "";
  valueInput.value = "";
}

function clearEditState() {
  editingMeta = null;
  saveInputBtn.textContent = "Save Item";
  cancelEditBtn.classList.add("hidden");
}

function showStatus(message, type = "success") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.classList.remove("hidden");

  clearTimeout(showStatus.timeoutId);
  showStatus.timeoutId = setTimeout(() => {
    statusMessage.classList.add("hidden");
    statusMessage.textContent = "";
  }, 2200);
}

function setEditMode(index) {
  const items = state.groups[state.currentGroup] || [];
  const item = items[index];
  if (!item) return;

  editingMeta = { groupName: state.currentGroup, index };
  keyInput.value = item.key || "";
  valueInput.value = item.value || "";
  saveInputBtn.textContent = "Save Edit";
  cancelEditBtn.classList.remove("hidden");
  manualForm.classList.remove("hidden");
  showManualFormBtn.textContent = "Hide Item Form";
}

function renderGroups() {
  groupSelect.innerHTML = "";
  Object.keys(state.groups).forEach((groupName) => {
    const option = document.createElement("option");
    option.value = groupName;
    option.textContent = groupName;
    if (groupName === state.currentGroup) {
      option.selected = true;
    }
    groupSelect.appendChild(option);
  });

  groupManagement.innerHTML = Object.keys(state.groups)
    .map((groupName) => {
      const active = groupName === state.currentGroup ? "group-row active" : "group-row";
      return `
        <div class="${active}">
          <span>${escapeHtml(groupName)}</span>
          <div class="group-actions">
            <button class="small" data-action="select" data-group="${escapeHtml(groupName)}">Select</button>
            <button class="small secondary" data-action="rename" data-group="${escapeHtml(groupName)}">Rename</button>
            <button class="small danger" data-action="delete" data-group="${escapeHtml(groupName)}">Delete</button>
          </div>
        </div>
      `;
    })
    .join("");

  groupManagement.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      const targetGroup = button.dataset.group;
      if (!targetGroup) return;

      if (action === "select") {
        state.currentGroup = targetGroup;
        clearEditState();
        saveState();
        render();
      } else if (action === "delete") {
        if (targetGroup === "Default") {
          showStatus("Default group cannot be deleted.", "error");
          return;
        }
        deleteGroup(targetGroup);
      } else if (action === "rename") {
        renameGroup(targetGroup);
      }
    });
  });
}

function renderItems() {
  const items = state.groups[state.currentGroup] || [];

  const visibleItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      const text = `${item.key || ""} ${item.value || ""}`.toLowerCase();
      return text.includes(searchTerm.toLowerCase());
    });

  groupTitle.textContent = `${state.currentGroup} (${visibleItems.length}/${items.length})`;

  if (!visibleItems.length) {
    itemsList.innerHTML = `<li class="empty">No matching items in this group.</li>`;
    return;
  }

  itemsList.innerHTML = visibleItems
    .map(({ item, index }) => {
      const safeKey = escapeHtml(item.key || "Untitled");
      const safeValue = escapeHtml(item.value || "");
      const faviconUrl = getFaviconUrl(item.value || "");

      const faviconMarkup = faviconUrl
        ? `<img class="favicon" src="${faviconUrl}" alt="favicon" />`
        : `<div class="favicon-placeholder">•</div>`;

      return `
        <li class="item-card" draggable="true" data-index="${index}">
          <div class="item-content">
            <input class="item-checkbox" type="checkbox" data-index="${index}" />
            ${faviconMarkup}
            <div class="item-text">
              <strong>${safeKey}</strong>
              <a href="${safeValue}" target="_blank" rel="noopener noreferrer">${safeValue}</a>
            </div>
          </div>

          <div class="item-actions">
            <button class="copy-item-btn small" data-index="${index}">Copy</button>
            <button class="edit-item-btn small" data-index="${index}">Edit</button>
            <button class="delete-item-btn small danger" data-index="${index}">Delete</button>
          </div>
        </li>
      `;
    })
    .join("");

  document.querySelectorAll(".item-card").forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      const index = Number(card.dataset.index);
      draggedItem = { groupName: state.currentGroup, index };
      e.dataTransfer.effectAllowed = "move";
    });

    card.addEventListener("dragend", () => {
      draggedItem = null;
    });
  });

  document.querySelectorAll(".copy-item-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      copyItemValue(Number(btn.dataset.index)),
    );
  });

  document.querySelectorAll(".edit-item-btn").forEach((btn) => {
    btn.addEventListener("click", () => setEditMode(Number(btn.dataset.index)));
  });

  document.querySelectorAll(".delete-item-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteItem(Number(btn.dataset.index)));
  });
}

function render() {
  renderGroups();
  renderItems();
}

function toggleGroupForm(show) {
  groupForm.classList.toggle("hidden", !show);
  if (!show) {
    groupNameInput.value = "";
  }
}

function toggleManualForm(show) {
  manualForm.classList.toggle("hidden", !show);
}

function closeManualForm() {
  toggleManualForm(false);
  showManualFormBtn.textContent = "Add Item Manually";
}

function deleteGroup(groupName) {
  if (!state.groups[groupName]) return;

  const confirmed = window.confirm(
    `Delete group "${groupName}" and all its saved values? This cannot be undone.`,
  );
  if (!confirmed) return;

  delete state.groups[groupName];
  if (state.currentGroup === groupName) {
    state.currentGroup = Object.keys(state.groups)[0] || "Default";
  }
  saveState();
  render();
  showStatus(`Deleted group ${groupName}.`, "success");
}

function renameGroup(groupName) {
  const nextName = prompt("Rename group", groupName);
  if (!nextName) return;
  const trimmed = nextName.trim();
  if (!trimmed || state.groups[trimmed]) return;
  state.groups[trimmed] = state.groups[groupName];
  delete state.groups[groupName];
  if (state.currentGroup === groupName) {
    state.currentGroup = trimmed;
  }
  saveState();
  render();
  showStatus(`Renamed group to ${trimmed}.`, "success");
}

function saveItemFromInput() {
  const group = ensureGroup(state.currentGroup);
  if (!group) return;

  const entry = buildEntry(keyInput.value, valueInput.value);
  if (!entry.value) {
    showStatus("Please enter a value or URL before saving.", "error");
    return;
  }

  if (editingMeta) {
    const targetGroupName = editingMeta.groupName;
    const items = state.groups[targetGroupName] || [];
    if (isDuplicateEntry(entry, targetGroupName, editingMeta.index)) {
      showStatus("This item already exists in this group.", "error");
      return;
    }
    items[editingMeta.index] = entry;
    clearEditState();
    closeManualForm();
    showStatus(`Updated item in ${targetGroupName}.`, "success");
  } else {
    const result = addEntryToGroup(group, entry);
    if (!result.added) {
      showStatus("This item already exists in this group.", "error");
      return;
    }
    showStatus(`Saved to ${group}.`, "success");
  }

  saveState();
  clearInputs();
  render();
}

function saveCurrentTab() {
  if (!chrome?.tabs?.query) {
    alert("This only works inside a Chrome extension.");
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url;
    if (!url) {
      showStatus("No active tab URL found.", "error");
      return;
    }

    const group = ensureGroup(state.currentGroup);
    if (!group) {
      showStatus("Please create or select a group first.", "error");
      return;
    }

    const entry = buildEntry("", url);
    const result = addEntryToGroup(group, entry);
    if (!result.added) {
      showStatus(`Current tab is already saved in ${group}.`, "error");
      return;
    }

    saveState();
    render();
    showStatus(`Saved current tab to ${group}.`, "success");
  });
}

function deleteItem(index) {
  const items = state.groups[state.currentGroup] || [];
  if (!items[index]) return;

  items.splice(index, 1);
  saveState();
  render();
}

function deleteSelectedItems() {
  const selectedIndexes = Array.from(
    document.querySelectorAll(".item-checkbox:checked"),
  ).map((checkbox) => Number(checkbox.dataset.index));

  if (!selectedIndexes.length) return;

  const items = state.groups[state.currentGroup] || [];
  const remaining = items.filter(
    (_, index) => !selectedIndexes.includes(index),
  );
  state.groups[state.currentGroup] = remaining;

  saveState();
  render();
}

function copyItemValue(index) {
  const items = state.groups[state.currentGroup] || [];
  const item = items[index];
  if (!item) return;

  navigator.clipboard.writeText(item.value || "").then(() => {
    const button = document.querySelector(
      `.copy-item-btn[data-index="${index}"]`,
    );
    if (button) {
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = "Copy";
      }, 1000);
    }
  });
}

function moveItemToGroup(fromGroup, toGroup, index) {
  if (!state.groups[toGroup] || fromGroup === toGroup) return;

  const fromItems = state.groups[fromGroup] || [];
  const item = fromItems.splice(index, 1)[0];
  if (!item) return;

  if (!state.groups[toGroup]) state.groups[toGroup] = [];
  state.groups[toGroup].push(item);

  state.currentGroup = toGroup;
  saveState();
  render();
}

function getExportItems() {
  const selectedIndexes = Array.from(
    document.querySelectorAll(".item-checkbox:checked"),
  ).map((checkbox) => Number(checkbox.dataset.index));

  const items = state.groups[state.currentGroup] || [];

  if (!selectedIndexes.length) return items;

  return selectedIndexes.map((index) => items[index]).filter(Boolean);
}

function buildCsv(items) {
  const rows = [["key", "value"]];
  items.forEach((item) => {
    rows.push([item.key || "", item.value || ""]);
  });

  return rows
    .map((row) =>
      row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}

function exportData(format) {
  const items = getExportItems();
  const content =
    format === "json"
      ? JSON.stringify(
          {
            group: state.currentGroup,
            exportedAt: new Date().toISOString(),
            items,
          },
          null,
          2,
        )
      : buildCsv(items);

  const blob = new Blob([content], {
    type: format === "json" ? "application/json" : "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.currentGroup}.${format}`;
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const rows = lines.map((line) => {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  });

  const headers = rows[0].map((header) => header.toLowerCase().trim());
  return rows.slice(1).map((row) => {
    const entry = {};
    headers.forEach((header, index) => {
      entry[header] = row[index] || "";
    });
    return entry;
  });
}

function importDataFromFile(file) {
  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const content = event.target.result;
      let parsedItems = [];

      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(content);
        parsedItems = Array.isArray(parsed)
          ? parsed
          : parsed.items || parsed.data || [];
      } else if (file.name.toLowerCase().endsWith(".csv")) {
        parsedItems = parseCsv(content);
      } else {
        alert("Please select a .json or .csv file.");
        return;
      }

      const group = ensureGroup(state.currentGroup);
      if (!group) return;

      parsedItems.forEach((item) => {
        const entry = buildEntry(
          item.key || item.name || "",
          item.value || item.url || "",
        );
        if (!isDuplicateEntry(entry, group)) {
          state.groups[group].push(entry);
        }
      });

      saveState();
      render();
      importFileInput.value = "";
    } catch (err) {
      alert("Unable to import this file.");
      console.error(err);
    }
  };

  reader.readAsText(file);
}

createGroupBtn.addEventListener("click", () => {
  const group = ensureGroup(groupNameInput.value);
  if (!group) return;

  state.currentGroup = group;
  groupNameInput.value = "";
  saveState();
  render();
  toggleGroupForm(false);
  showStatus(`Created group ${group}.`, "success");
});

groupSelect.addEventListener("change", (e) => {
  const selected = e.target.value;
  if (state.groups[selected]) {
    state.currentGroup = selected;
    clearEditState();
    saveState();
    render();
  }
});

searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  render();
});

showGroupFormBtn.addEventListener("click", () => toggleGroupForm(true));
manageGroupsBtn.addEventListener("click", () => {
  const isHidden = groupManagement.classList.toggle("hidden");
  manageGroupsBtn.textContent = isHidden ? "See Groups" : "Hide Groups";
  if (!isHidden) {
    renderGroups();
  }
});
showManualFormBtn.addEventListener("click", () => {
  const isHidden = manualForm.classList.toggle("hidden");
  showManualFormBtn.textContent = isHidden ? "Add Item Manually" : "Hide Item Form";
});
saveInputBtn.addEventListener("click", saveItemFromInput);
saveTabBtn.addEventListener("click", saveCurrentTab);
cancelEditBtn.addEventListener("click", () => {
  clearEditState();
  closeManualForm();
});

deleteBtn.addEventListener("click", deleteSelectedItems);

exportJsonBtn.addEventListener("click", () => exportData("json"));
exportCsvBtn.addEventListener("click", () => exportData("csv"));

importBtn.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  importDataFromFile(file);
});

if (chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[STORAGE_KEY]) {
      state = parseStoredState(changes[STORAGE_KEY].newValue);
      render();
    }
  });
}

toggleGroupForm(false);
toggleManualForm(false);
groupManagement.classList.add("hidden");
manageGroupsBtn.textContent = "See Groups";
showManualFormBtn.textContent = "Add Item Manually";
hydrateStateFromStorage();
render();
