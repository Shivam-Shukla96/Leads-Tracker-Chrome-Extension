const STORAGE_KEY = "leads-tracker-v2";

let state = loadState();

const groupNameInput = document.getElementById("group-name");
const createGroupBtn = document.getElementById("create-group-btn");
const groupSelect = document.getElementById("group-select");
const keyInput = document.getElementById("key-input");
const valueInput = document.getElementById("value-input");
const saveInputBtn = document.getElementById("save-input-btn");
const saveTabBtn = document.getElementById("save-tab-btn");
const deleteBtn = document.getElementById("delete-btn");
const itemsList = document.getElementById("items-list");
const groupTitle = document.getElementById("group-title");

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    const groups = saved.groups && typeof saved.groups === "object"
      ? saved.groups
      : {};

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

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

function extractKeyFromText(text) {
  const value = (text || "").trim();
  if (!value) return "Untitled";

  const urlMatch = value.match(/https?:\/\/(?:www\.)?([^/\s]+)/i);
  if (urlMatch) {
    return urlMatch[1].replace(/^www\./, "");
  }

  const pathMatch = value.match(/\/([a-z0-9-]+)(?:\/|$)/i);
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
    value: safeValue
  };
}

function clearInputs() {
  keyInput.value = "";
  valueInput.value = "";
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
}

function renderItems() {
  const items = state.groups[state.currentGroup] || [];

  groupTitle.textContent = `${state.currentGroup} (${items.length})`;

  if (!items.length) {
    itemsList.innerHTML = `<li class="empty">No saved items in this group yet.</li>`;
    return;
  }

  itemsList.innerHTML = items
    .map((item, index) => {
      const safeKey = escapeHtml(item.key || "Untitled");
      const safeValue = escapeHtml(item.value || "");

      return `
        <li class="item-card">
          <div class="item-content">
            <input class="item-checkbox" type="checkbox" data-index="${index}" />
            <div>
              <strong>${safeKey}</strong>
              <a href="${safeValue}" target="_blank" rel="noopener noreferrer">${safeValue}</a>
            </div>
          </div>
          <button class="delete-item-btn" data-index="${index}">Delete</button>
        </li>
      `;
    })
    .join("");

  document.querySelectorAll(".delete-item-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      deleteItem(Number(btn.dataset.index));
    });
  });
}

function render() {
  renderGroups();
  renderItems();
}

function saveItemFromInput() {
  const group = ensureGroup(state.currentGroup);
  if (!group) return;

  const key = keyInput.value;
  const value = valueInput.value;

  if (!value.trim()) return;

  state.groups[group].push(buildEntry(key, value));
  saveState();
  clearInputs();
  render();
}

function saveTab() {
  if (!chrome?.tabs?.query) {
    alert("This only works inside a Chrome extension.");
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url;
    if (!url) return;

    const group = ensureGroup(state.currentGroup);
    if (!group) return;

    state.groups[group].push(buildEntry("", url));
    saveState();
    render();
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
    document.querySelectorAll(".item-checkbox:checked")
  ).map((checkbox) => Number(checkbox.dataset.index));

  if (!selectedIndexes.length) return;

  const items = state.groups[state.currentGroup] || [];

  const remaining = items.filter((_, index) => !selectedIndexes.includes(index));
  state.groups[state.currentGroup] = remaining;

  saveState();
  render();
}

createGroupBtn.addEventListener("click", () => {
  const group = ensureGroup(groupNameInput.value);
  if (!group) return;

  state.currentGroup = group;
  groupNameInput.value = "";
  saveState();
  render();
});

groupSelect.addEventListener("change", (e) => {
  const selected = e.target.value;
  if (state.groups[selected]) {
    state.currentGroup = selected;
    saveState();
    render();
  }
});

saveInputBtn.addEventListener("click", saveItemFromInput);
saveTabBtn.addEventListener("click", saveTab);
deleteBtn.addEventListener("click", deleteSelectedItems);

render();