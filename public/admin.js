let tools = [];

function getMessage(type) {
    const params = new URLSearchParams(window.location.search);
    if (type === "success" && params.get("success") === "1") return "Tool added successfully.";
    if (type === "success" && params.get("success") === "deleted") return "Tool deleted successfully.";
    if (type === "error" && params.get("error") === "empty") return "Please fill in all fields.";
    if (type === "error" && params.get("error") === "invalid") return "Invalid category or type.";
    if (type === "error" && params.get("error") === "db") return "Database error.";
    if (type === "error" && params.get("error") === "invalid") return "Invalid request.";
    return "";
}

function showMessage() {
    const box = document.getElementById("msg");
    if (!box) return;
    const success = getMessage("success");
    const error = getMessage("error");
    if (success) {
        box.innerHTML = '<div class="admin-success">' + success + '</div>';
    } else if (error) {
        box.innerHTML = '<div class="admin-error">' + error + '</div>';
    } else {
        box.innerHTML = "";
    }
}

function badgeLabel(value) {
    return value === "free" ? "FREE" : "PAID";
}

function catLabel(value) {
    const map = {
        ai: "AI",
        design: "DESIGN",
        writing: "WRITING",
        video: "VIDEO",
        education: "EDUCATION"
    };
    return map[value] || value;
}

function escapeHtml(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
}

async function loadCount() {
    try {
        const response = await fetch("/api/tools/count");
        const data = await response.json();
        const count1 = document.getElementById("toolsCount");
        const count2 = document.getElementById("toolsCount2");
        if (count1) count1.textContent = data.count + " tools";
        if (count2) count2.textContent = data.count + " tools";
    } catch (e) {}
}

function renderTable() {
    const tbody = document.getElementById("toolsTable");
    if (!tbody) return;

    if (!tools.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="admin-tbl-loading">No tools found.</td></tr>';
        return;
    }

    tbody.innerHTML = tools.map((tool, index) => {
        return '<tr>' +
            '<td>' + (index + 1) + '</td>' +
            '<td>' + escapeHtml(tool.name) + '</td>' +
            '<td>' + catLabel(tool.cat) + '</td>' +
            '<td><span class="admin-badge ' + escapeHtml(tool.badge) + '">' + badgeLabel(tool.badge) + '</span></td>' +
            '<td><a href="' + escapeHtml(tool.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(tool.url) + '</a></td>' +
            '<td><form method="POST" action="/admin/tools/delete/' + tool.id + '" onsubmit="return confirm(\'Delete this tool?\')"><button type="submit" class="admin-del-btn">DELETE</button></form></td>' +
        '</tr>';
    }).join("");
}

async function loadTools() {
    const tbody = document.getElementById("toolsTable");
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="admin-tbl-loading" id="t-loading">LOADING...</td></tr>';

    try {
        const response = await fetch("/admin/tools");
        const data = await response.json();
        tools = Array.isArray(data) ? data : [];
        renderTable();
        loadCount();
    } catch (e) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="admin-tbl-loading">Failed to load tools.</td></tr>';
    }
}

document.addEventListener("DOMContentLoaded", () => {
    showMessage();
    loadTools();
});
