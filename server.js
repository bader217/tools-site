const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const VALID_CATS = ["ai", "design", "writing", "video", "education"];
const VALID_BADGES = ["free", "paid"];

const TOOLS_FILE = path.join(__dirname, "data", "tools.json");
const ADMINS_FILE = path.join(__dirname, "data", "admins.json");

function readTools() {
    try {
        return JSON.parse(fs.readFileSync(TOOLS_FILE, "utf8"));
    } catch {
        return [];
    }
}

function writeTools(tools) {
    fs.writeFileSync(TOOLS_FILE, JSON.stringify(tools, null, 2), "utf8");
}

function readAdmins() {
    try {
        return JSON.parse(fs.readFileSync(ADMINS_FILE, "utf8"));
    } catch {
        return [];
    }
}

function nextId(items) {
    if (!items.length) return 1;
    return Math.max(...items.map(t => t.id || 0)) + 1;
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
    secret: process.env.SESSION_SECRET || "tools-site-secret-local",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

function normalizePage(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
}

app.get("/api/tools", (req, res) => {
    const cat = String(req.query.cat || "all").toLowerCase();
    const page = normalizePage(req.query.page);
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);

    let tools = readTools();

    if (cat !== "all" && VALID_CATS.includes(cat)) {
        tools = tools.filter(t => t.cat === cat);
    }

    const total = tools.length;
    const offset = (page - 1) * limit;
    const paginated = tools.slice().reverse().slice(offset, offset + limit);

    res.json({
        tools: paginated.map(t => ({
            id: t.id,
            name: t.name,
            cat: t.cat,
            badge: t.badge,
            description: t.description || "",
            url: t.url
        })),
        total
    });
});

app.get("/api/tools/count", (req, res) => {
    const tools = readTools();
    res.json({ count: tools.length });
});

app.get("/admin/login", (req, res) => {
    if (req.session.isAdmin) return res.redirect("/admin/dashboard");
    res.sendFile(path.join(__dirname, "public", "admin-login.html"));
});

app.post("/admin/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) return res.redirect("/admin/login?error=1");

    const admins = readAdmins();
    const admin = admins.find(a => a.username === username);

    if (!admin) return res.redirect("/admin/login?error=1");

    const stored = String(admin.password || "");

    const finish = (ok) => {
        if (!ok) return res.redirect("/admin/login?error=1");
        req.session.isAdmin = true;
        req.session.adminId = admin.id;
        req.session.save(err => {
            if (err) return res.redirect("/admin/login?error=1");
            res.redirect("/admin/dashboard");
        });
    };

    if (stored.startsWith("$2")) {
        bcrypt.compare(password, stored, (err, match) => {
            if (err) return res.redirect("/admin/login?error=1");
            finish(match);
        });
    } else {
        finish(password === stored);
    }
});

app.get("/admin/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
});

app.get("/admin/dashboard", (req, res) => {
    if (!req.session.isAdmin) return res.redirect("/admin/login");
    res.sendFile(path.join(__dirname, "public", "admin-dashboard.html"));
});

app.get("/admin/tools", (req, res) => {
    if (!req.session.isAdmin) return res.status(403).json({ error: "Forbidden" });
    const tools = readTools().slice().reverse();
    res.json(tools);
});

app.post("/admin/tools/add", (req, res) => {
    if (!req.session.isAdmin) return res.status(403).json({ error: "Forbidden" });

    const { name, cat, badge, description, url } = req.body;

    if (!name || !cat || !badge || !description || !url) {
        return res.redirect("/admin/dashboard?error=empty");
    }

    if (!VALID_CATS.includes(cat) || !VALID_BADGES.includes(badge)) {
        return res.redirect("/admin/dashboard?error=invalid");
    }

    const tools = readTools();
    tools.push({ id: nextId(tools), name, cat, badge, description, url });
    writeTools(tools);

    res.redirect("/admin/dashboard?success=1");
});

app.post("/admin/tools/delete/:id", (req, res) => {
    if (!req.session.isAdmin) return res.status(403).json({ error: "Forbidden" });

    const id = parseInt(req.params.id, 10);
    if (!id || Number.isNaN(id)) return res.redirect("/admin/dashboard?error=invalid");

    const tools = readTools();
    const filtered = tools.filter(t => t.id !== id);

    if (filtered.length === tools.length) {
        return res.redirect("/admin/dashboard?error=invalid");
    }

    writeTools(filtered);
    res.redirect("/admin/dashboard?success=deleted");
});

app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
});
