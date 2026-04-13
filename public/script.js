let currentFilter = "all";
let currentPage = 1;
const LIMIT = 28;

const T = {
    loading: "LOADING...",
    noResults: "NO RESULTS FOUND.",
    error: "CONNECTION ERROR.",
    visit: "VISIT →",
    free: "FREE",
    paid: "PAID"
};

function normalizePageNumber(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
}

function isBrowsePage() {
    return window.location.pathname.toLowerCase().includes("browse.html");
}

function getCurrentToolsHref(pageNumber) {
    const page = normalizePageNumber(pageNumber);
    const params = new URLSearchParams();
    if (currentFilter && currentFilter !== "all") params.set("cat", currentFilter);
    params.set("page", String(page));
    if (page === 1) {
        return isBrowsePage() ? "/browse.html?" + params.toString() : "/";
    }
    return "/browse.html?" + params.toString();
}

function syncFilterButtons() {
    document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active-btn"));
    const active = document.getElementById("btn-" + currentFilter);
    if (active) active.classList.add("active-btn");
}

function initStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    currentPage = normalizePageNumber(params.get("page"));
    const cat = params.get("cat");
    currentFilter = cat && ["all", "ai", "design", "writing", "video", "education"].includes(cat) ? cat : "all";
}

window.onload = function() {
    initStateFromUrl();
    syncFilterButtons();
    showTools();
    loadToolsCount();
};

async function loadToolsCount() {
    try {
        const response = await fetch("/api/tools/count");
        const data = await response.json();
        const el = document.getElementById("total-count");
        if (el) el.textContent = data.count + "+";
    } catch (e) {}
}

async function showTools() {
    const container = document.getElementById("tools-list");
    if (!container) return;

    container.innerHTML = "<p class='loading'>" + T.loading + "</p>";

    try {
        const url = "/api/tools?cat=" + encodeURIComponent(currentFilter) + "&page=" + currentPage + "&limit=" + LIMIT;
        const response = await fetch(url);
        const data = await response.json();

        container.innerHTML = "";

        if (!data.tools || data.tools.length === 0) {
            container.innerHTML = "<p class='no-results'>" + T.noResults + "</p>";
            renderPagination(0);
            return;
        }

        for (let i = 0; i < data.tools.length; i++) {
            container.appendChild(buildCard(data.tools[i]));
        }

        renderPagination(Math.ceil(data.total / LIMIT));
    } catch (e) {
        container.innerHTML = "<p class='no-results'>" + T.error + "</p>";
    }
}

function buildCard(tool) {
    const badgeText = tool.badge === "free" ? T.free : T.paid;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML =
        "<div class='card-top'>" +
            "<h3>" + escapeHtml(tool.name) + "</h3>" +
            "<span class='badge " + escapeHtml(tool.badge) + "'>" + badgeText + "</span>" +
        "</div>" +
        "<p>" + escapeHtml(tool.description || "") + "</p>" +
        "<a href='" + escapeHtml(tool.url) + "' target='_blank' rel='noopener noreferrer'>" + T.visit + "</a>";
    return card;
}

function renderPagination(totalPages) {
    const pag = document.getElementById("pagination");
    if (!pag) return;
    pag.innerHTML = "";
    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const link = document.createElement("a");
        link.textContent = i;
        link.href = getCurrentToolsHref(i);
        link.className = "page-btn";
        link.setAttribute("aria-label", "Page " + i);
        if (i === currentPage) {
            link.classList.add("active-page");
            link.setAttribute("aria-current", "page");
        }
        pag.appendChild(link);
    }
}

function setFilter(cat) {
    currentFilter = cat;
    currentPage = 1;
    syncFilterButtons();
    showTools();
    const target = document.getElementById("tools");
    if (target) target.scrollIntoView({ behavior: "smooth" });
}

function escapeHtml(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
}
