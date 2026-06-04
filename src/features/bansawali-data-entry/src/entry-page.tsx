import { useEffect, useMemo, useRef, useState } from "react";
import { ReactTransliterate } from "react-transliterate";
import "react-transliterate/dist/index.css";
import "./App.css";

type Member = {
  id: number;
  name: string;
  name_roman?: string;
  parent_id: number | null;
};

type Meta = {
  address: string;
  address_roman: string;
  family_name: string;
  family_name_roman: string;
  page_start: string;
};

type Toast = {
  msg: string;
  type: "ok" | "err" | "";
};

const STORAGE_KEY = "vanshaawali_state";

export function BamsawaliEntryPage() {
  const [meta, setMeta] = useState<Meta>({
    address: "",
    address_roman: "",
    family_name: "",
    family_name_roman: "",
    page_start: "",
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [nextId, setNextId] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"tree" | "json" | "import">(
    "tree",
  );
  const [nameInput, setNameInput] = useState("");
  const [nameRoman, setNameRoman] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [addressRoman, setAddressRoman] = useState("");
  const [familyNameInput, setFamilyNameInput] = useState("");
  const [familyNameRoman, setFamilyNameRoman] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [importText, setImportText] = useState("");
  const [importFeedback, setImportFeedback] = useState("");
  const [toast, setToast] = useState<Toast>({ msg: "", type: "" });
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      const normalized = normalizeState(parsed);
      setMeta(normalized.meta);
      setMembers(normalized.members);
      setNextId(normalized.nextId);
      setEditingId(normalized.editingId);
    } catch {
      // ignore corrupted storage
    }
  }, []);

  useEffect(() => {
    const payload = { meta, members, nextId, editingId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [meta, members, nextId, editingId]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const jsonObject = useMemo(() => {
    return {
      _meta: {
        address: addressInput || "",
        address_roman: addressRoman || "",
        family_name: familyNameInput || "",
        family_name_roman: familyNameRoman || "",
        page_start: meta.page_start || "",
      },
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        name_roman: m.name_roman,
        parent_id: m.parent_id ?? null,
      })),
    };
  }, [meta, members]);

  const jsonRaw = useMemo(
    () => JSON.stringify(jsonObject, null, 2),
    [jsonObject],
  );
  const jsonHtml = useMemo(() => syntaxHighlight(jsonRaw), [jsonRaw]);

  const parentOptions = useMemo(() => members, [members]);
  const memberCount = members.length;

  const treeRoots = useMemo(() => {
    const childrenOf: Record<number, Member[]> = {};
    members.forEach((m) => {
      childrenOf[m.id] = [];
    });
    const roots: Member[] = [];
    members.forEach((m) => {
      if (m.parent_id === null || m.parent_id === undefined) {
        roots.push(m);
      } else {
        if (!childrenOf[m.parent_id]) childrenOf[m.parent_id] = [];
        childrenOf[m.parent_id].push(m);
      }
    });
    return { roots, childrenOf };
  }, [members]);

  const handleNameChange = (text: string) => {
    setNameInput(text);
    if (isRomanText(text)) {
      setNameRoman(text);
    }
  };

  const handleAddressChange = (text: string) => {
    setAddressInput(text);

    setMeta((prev) => ({
      ...prev,
      address: text,
    }));

    if (isRomanText(text)) {
      setAddressRoman(text);

      setMeta((prev) => ({
        ...prev,
        address_roman: text,
      }));
    }
  };

  const handleFamilyNameChange = (text: string) => {
    setFamilyNameInput(text);

    setMeta((prev) => ({
      ...prev,
      family_name: text,
    }));

    if (isRomanText(text)) {
      setFamilyNameRoman(text);

      setMeta((prev) => ({
        ...prev,
        family_name_roman: text,
      }));
    }
  };

  const addOrUpdateMember = () => {
    const name = nameInput.trim();
    const roman = (nameRoman || (isRomanText(name) ? name : "")).trim();
    if (!name) {
      showToast("Name is required.", "err");
      return;
    }
    const parent_id = parentId ? Number(parentId) : null;

    if (editingId !== null) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === editingId
            ? {
                ...m,
                name,
                name_roman: roman || undefined,
                parent_id,
              }
            : m,
        ),
      );
      showToast(`Updated: ${roman || name}`, "ok");
      cancelEdit();
      return;
    }

    setMembers((prev) => [
      ...prev,
      { id: nextId, name, name_roman: roman || undefined, parent_id },
    ]);
    setNextId((id) => id + 1);
    showToast(`Added: ${roman || name}`, "ok");
    clearForm();
  };

  const clearForm = () => {
    setNameInput("");
    setNameRoman("");
    setParentId("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    clearForm();
  };

  const editMember = (id: number) => {
    const member = members.find((m) => m.id === id);
    if (!member) return;
    setEditingId(id);
    setNameInput(member.name);
    setNameRoman(member.name_roman || "");
    setParentId(
      member.parent_id !== null && member.parent_id !== undefined
        ? String(member.parent_id)
        : "",
    );
  };

  const deleteMember = (id: number) => {
    const toDelete = new Set<number>();
    const collect = (pid: number) => {
      toDelete.add(pid);
      members.filter((m) => m.parent_id === pid).forEach((m) => collect(m.id));
    };
    collect(id);
    if (toDelete.size > 1) {
      const ok = window.confirm(
        `This will also delete ${toDelete.size - 1} descendant(s). Continue?`,
      );
      if (!ok) return;
    }
    setMembers((prev) => prev.filter((m) => !toDelete.has(m.id)));
    if (editingId && toDelete.has(editingId)) cancelEdit();
    showToast("Deleted.", "ok");
  };

  const setParent = (id: number) => {
    setParentId(String(id));
    showToast("Parent set. Now fill in the new member's name.", "ok");
  };

  const showToast = (msg: string, type: Toast["type"]) => {
    setToast({ msg, type });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(
      () => setToast({ msg: "", type: "" }),
      2800,
    );
  };

  const copyJSON = async () => {
    await navigator.clipboard.writeText(jsonRaw);
    showToast("Copied to clipboard!", "ok");
  };

  const downloadJSON = () => {
    const blob = new Blob([jsonRaw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const fname = (meta.family_name || "family") + "_vanshaawali.json";
    a.href = url;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = () => {
    const text = importText.trim();
    try {
      const parsed = JSON.parse(text);
      if (!parsed.members || !Array.isArray(parsed.members)) {
        throw new Error('Missing "members" array');
      }
      const normalized = normalizeState({
        meta: parsed._meta || {},
        members: parsed.members,
        nextId: parsed.nextId,
        editingId: null,
      });
      setMeta(normalized.meta);
      setMembers(normalized.members);
      setNextId(normalized.nextId);
      setEditingId(null);
      setImportFeedback(`✓ Imported ${normalized.members.length} members.`);
      setActiveTab("tree");
      showToast("Import complete.", "ok");
    } catch (err) {
      setImportFeedback(`✕ Invalid JSON: ${(err as Error).message}`);
    }
  };

  const loadSampleData = () => {
    if (members.length > 0) {
      const ok = window.confirm("This will replace current data. Continue?");
      if (!ok) return;
    }
    const sampleMembers: Member[] = [
      {
        id: 1,
        name: "बलि पाध्याय",
        name_roman: "Bali Padhyay",
        parent_id: null,
      },
      { id: 2, name: "लक्ष्मण", name_roman: "Laxman", parent_id: 1 },
      { id: 3, name: "वशिष्ठ", name_roman: "Vasistha", parent_id: 2 },
      { id: 4, name: "घनश्याम", name_roman: "Ghanashyam", parent_id: 3 },
      { id: 5, name: "पुण्यशिल", name_roman: "Punyashil", parent_id: 4 },
      { id: 6, name: "परशुराम", name_roman: "Parashuram", parent_id: 5 },
      { id: 7, name: "नयनानन्द", name_roman: "Nayananda", parent_id: 6 },
      { id: 8, name: "प्राणनाथ", name_roman: "Prananath", parent_id: 7 },
      { id: 9, name: "रघुनाथ", name_roman: "Raghunath", parent_id: 7 },
      { id: 10, name: "जगन्नाथ", name_roman: "Jagannath", parent_id: 7 },
      { id: 11, name: "भीम बहादुर", name_roman: "Bhim Bahadur", parent_id: 10 },
      { id: 12, name: "साधुराम", name_roman: "Sadhuram", parent_id: 11 },
      { id: 13, name: "आनन्दराम", name_roman: "Aanandaram", parent_id: 11 },
      { id: 14, name: "राजेन्द्र", name_roman: "Rajendra", parent_id: 12 },
      { id: 15, name: "राजु", name_roman: "Raju", parent_id: 12 },
      { id: 16, name: "शंकर", name_roman: "Shankar", parent_id: 13 },
      { id: 17, name: "सन्तोष", name_roman: "Santosh", parent_id: 13 },
      { id: 18, name: "ओमप्रकाश", name_roman: "Omprakash", parent_id: 13 },
      { id: 19, name: "राजीव", name_roman: "Rajeev", parent_id: 15 },
    ];
    setMeta({
      address: "पाँचघर (देवीस्थान) (हाल दुवाकोट)",
      address_roman: "Panchghar (Devisthan) (Duwakot)",
      family_name: "राजु न्यौपाने (खत्री)",
      family_name_roman: "Raju Neupane (Khatri)",
      page_start: "299",
    });
    setMembers(sampleMembers);
    setNextId(20);
    setEditingId(null);
    clearForm();
    showToast("Sample data loaded!", "ok");
  };

  const clearAll = () => {
    const ok = window.confirm("Clear all data?");
    if (!ok) return;
    setMeta({
      address: "",
      address_roman: "",
      family_name: "",
      family_name_roman: "",
      page_start: "",
    });
    setMembers([]);
    setNextId(1);
    setEditingId(null);
    clearForm();
  };

  return (
    <div className="app-shell">
      <header>
        <h1>वंशावली</h1>
        <span className="sub">Family Tree Entry Tool</span>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={loadSampleData}>
            Load Sample
          </button>
          <button className="btn btn-ghost" onClick={clearAll}>
            Clear All
          </button>
          <button className="btn btn-success" onClick={downloadJSON}>
            ⬇ Download JSON
          </button>
        </div>
      </header>

      <div className="layout">
        <div className="panel-left">
          <div className="panel-section">
            <h2>Book / Source Info</h2>
            <div className="field">
              <label>Address (Roman)</label>

              <ReactTransliterate
                value={addressInput}
                onChangeText={handleAddressChange}
                lang="ne"
                maxOptions={6}
                showCurrentWordAsLastSuggestion
                containerClassName="transliterate-container"
                renderComponent={(props) => (
                  <input
                    {...props}
                    type="text"
                    placeholder="e.g. Panchghar"
                    className="transliterate-input"
                  />
                )}
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Family Name</label>

                <ReactTransliterate
                  value={familyNameInput}
                  lang="ne"
                  onChangeText={handleFamilyNameChange}
                  maxOptions={6}
                  showCurrentWordAsLastSuggestion
                  containerClassName="transliterate-container"
                  renderComponent={(props) => (
                    <input
                      {...props}
                      type="text"
                      placeholder="e.g. Nyaupane"
                      className="transliterate-input"
                    />
                  )}
                />
              </div>
              <div className="field">
                <label>Page Start</label>
                <input
                  type="text"
                  value={meta.page_start}
                  onChange={(e) =>
                    setMeta((prev) => ({ ...prev, page_start: e.target.value }))
                  }
                  placeholder="e.g. page 299"
                />
              </div>
            </div>
          </div>

          <div className="panel-section">
            <h2 id="form-title">
              {editingId !== null ? "Edit Member" : "Add Member"}
            </h2>
            {editingId !== null && (
              <div className="edit-banner show">
                <span>
                  Editing member #<span id="edit-id-display">{editingId}</span>
                </span>
                <button onClick={cancelEdit}>Cancel Edit</button>
              </div>
            )}
            <div className="field">
              <label>Name (Roman input with suggestions)</label>
              <ReactTransliterate
                value={nameInput}
                onChangeText={handleNameChange}
                lang="ne"
                maxOptions={6}
                showCurrentWordAsLastSuggestion
                containerClassName="transliterate-container"
                renderComponent={(props) => (
                  <input
                    {...props}
                    type="text"
                    placeholder="e.g. Raghunath"
                    className="transliterate-input"
                  />
                )}
              />
              {/* <input
                value={nameInput}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Raghunath"
                className="transliterate-input"
              /> */}
              <div className="field-hint">Roman: {nameRoman || "—"}</div>
            </div>
            <div className="field">
              <label>Parent</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">— Root (no parent) —</option>
                {parentOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.id} — {m.name}
                    {m.name_roman ? ` (${m.name_roman})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <button className="add-btn" onClick={addOrUpdateMember}>
              {editingId !== null ? "✓ Save Changes" : "＋ Add Member"}
            </button>
            {toast.msg && (
              <div className={`toast show ${toast.type}`}>{toast.msg}</div>
            )}
          </div>

          <div
            className="panel-section"
            style={{ borderBottom: "none", paddingBottom: 6 }}
          >
            <h2>
              Members <span className="count-badge">{memberCount}</span>
            </h2>
          </div>
          <div className="members-list">
            {members.length === 0 ? (
              <div className="empty-members">
                No members yet. Add one above.
              </div>
            ) : (
              members.map((m) => {
                const parentName =
                  m.parent_id !== null && m.parent_id !== undefined
                    ? members.find((p) => p.id === m.parent_id)?.name_roman ||
                      `#${m.parent_id}`
                    : "(root)";
                return (
                  <div
                    key={m.id}
                    className={`member-item${editingId === m.id ? " editing" : ""}`}
                  >
                    <span className="member-id">{m.id}</span>
                    <div className="member-names">
                      <div className="member-devanagari">{m.name}</div>
                      <div className="member-roman">
                        {m.name_roman || ""} · ↑ {parentName}
                      </div>
                    </div>
                    <div className="member-actions">
                      <button
                        className="icon-btn"
                        title="Set as parent for next entry"
                        onClick={() => setParent(m.id)}
                      >
                        ⬆
                      </button>
                      <button
                        className="icon-btn"
                        title="Edit"
                        onClick={() => editMember(m.id)}
                      >
                        ✎
                      </button>
                      <button
                        className="icon-btn del"
                        title="Delete"
                        onClick={() => deleteMember(m.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="panel-right">
          <div className="tab-bar">
            <div
              className={`tab${activeTab === "tree" ? " active" : ""}`}
              onClick={() => setActiveTab("tree")}
            >
              Tree Preview
            </div>
            <div
              className={`tab${activeTab === "json" ? " active" : ""}`}
              onClick={() => setActiveTab("json")}
            >
              JSON Output
            </div>
            <div
              className={`tab${activeTab === "import" ? " active" : ""}`}
              onClick={() => setActiveTab("import")}
            >
              Import JSON
            </div>
          </div>

          <div
            className={`tab-content${activeTab === "tree" ? " active" : ""}`}
          >
            <div id="tree-view">
              {members.length === 0 ? (
                <div className="empty-tree">
                  <div className="big">🌳</div>
                  <div>Add members to see the tree</div>
                </div>
              ) : (
                <div className="tree-root" style={{ gap: 40 }}>
                  {treeRoots.roots.map((root) => (
                    <TreeNode
                      key={root.id}
                      member={root}
                      childrenOf={treeRoots.childrenOf}
                      highlightedId={editingId}
                      onSelectParent={setParent}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            className={`tab-content${activeTab === "json" ? " active" : ""}`}
          >
            <div id="json-view">
              <div className="json-toolbar">
                <button className="btn btn-ghost" onClick={copyJSON}>
                  ⎘ Copy
                </button>
                <button className="btn btn-success" onClick={downloadJSON}>
                  ⬇ Download
                </button>
                <span>
                  {jsonRaw.length.toLocaleString()} chars · {memberCount}{" "}
                  members
                </span>
              </div>
              <div
                id="json-output"
                dangerouslySetInnerHTML={{ __html: jsonHtml }}
              />
            </div>
          </div>

          <div
            className={`tab-content${activeTab === "import" ? " active" : ""}`}
          >
            <div id="import-view">
              <h3>Import existing JSON</h3>
              <p>
                Paste a previously exported JSON file here to continue editing
                it.
              </p>
              <textarea
                id="import-textarea"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='Paste your JSON here...\n\n{"_meta":{...},"members":[...]}'
                spellCheck={false}
              />
              <div className="import-actions">
                <button className="btn btn-primary" onClick={importJSON}>
                  Import & Replace
                </button>
                <span
                  id="import-feedback"
                  className={importFeedback.startsWith("✓") ? "ok" : "err"}
                >
                  {importFeedback}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeState(parsed: {
  meta?: Partial<Meta> & { address?: string; source?: string };
  members?: Member[];
  nextId?: number;
  editingId?: number | null;
}) {
  const meta = parsed.meta || {};
  const normalizedMeta: Meta = {
    address: meta.address || "",
    address_roman: meta.address_roman || "",
    family_name: meta.family_name || "",
    family_name_roman: meta.family_name_roman || "",
    page_start: meta.page_start || meta.source || "",
  };
  const members = Array.isArray(parsed.members) ? parsed.members : [];
  const nextId =
    parsed.nextId || Math.max(0, ...members.map((m) => m.id)) + 1 || 1;
  return {
    meta: normalizedMeta,
    members,
    nextId,
    editingId: parsed.editingId ?? null,
  };
}

function syntaxHighlight(json: string) {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = "json-num";
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? "json-key" : "json-str";
        } else if (/true|false/.test(match)) {
          cls = "json-bool";
        } else if (/null/.test(match)) {
          cls = "json-null";
        }
        return `<span class="${cls}">${match}</span>`;
      },
    );
}

function isRomanText(text: string) {
  return /^[a-zA-Z0-9\s.'-]*$/.test(text);
}

function TreeNode({
  member,
  childrenOf,
  highlightedId,
  onSelectParent,
}: {
  member: Member;
  childrenOf: Record<number, Member[]>;
  highlightedId: number | null;
  onSelectParent: (id: number) => void;
}) {
  const children = childrenOf[member.id] || [];
  return (
    <div className="tree-node-wrap">
      <div
        className={`tree-node${highlightedId === member.id ? " highlighted" : ""}`}
        title={`Click to set as parent | ID: ${member.id}`}
        onClick={() => onSelectParent(member.id)}
      >
        <div className="tree-node-devanagari">{member.name}</div>
        {member.name_roman && (
          <div className="tree-node-roman">{member.name_roman}</div>
        )}
      </div>
      {children.length > 0 && (
        <>
          <div className="tree-connector-down" />
          <div className="tree-children">
            <div className="tree-children-inner">
              {children.map((child) => (
                <div key={child.id} className="tree-child-col">
                  <TreeNode
                    member={child}
                    childrenOf={childrenOf}
                    highlightedId={highlightedId}
                    onSelectParent={onSelectParent}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
