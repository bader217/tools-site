const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const VALID_CATS = ["ai", "design", "writing", "video", "education"];
const VALID_BADGES = ["free", "paid"];

const seedTools = JSON.parse(fs.readFileSync(path.join(__dirname, "tools-seed.json"), "utf8"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
    secret: process.env.SESSION_SECRET || "tools-site-secret-local",
    resave: true,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

function createDbConnection() {
    const db = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "tools_db"
    });

    db.connect(err => {
        if (err) {
            console.log("MySQL connection failed:", err.message);
            return;
        }
        console.log("Connected to MySQL");
    });

    db.on("error", err => {
        console.log("MySQL error:", err.message);
    });

    return db;
}

let dbConnection = createDbConnection();

function repairSeedData() {
    if (!Array.isArray(seedTools) || seedTools.length === 0) return;

    let index = 0;

    const next = () => {
        if (index >= seedTools.length) return;
        const tool = seedTools[index++];

        dbConnection.query("SELECT id FROM tools WHERE name = ? LIMIT 1", [tool.name], (err, results) => {
            if (err) {
                next();
                return;
            }

            const values = [tool.cat, tool.badge, tool.description, tool.url];

            if (results && results.length > 0) {
                dbConnection.query(
                    "UPDATE tools SET cat = ?, badge = ?, description = ?, url = ? WHERE id = ?",
                    [...values, results[0].id],
                    () => next()
                );
            } else {
                dbConnection.query(
                    "INSERT INTO tools (name, cat, badge, description, url) VALUES (?, ?, ?, ?, ?)",
                    [tool.name, tool.cat, tool.badge, tool.description, tool.url],
                    () => next()
                );
            }
        });
    };

    next();
}

setTimeout(repairSeedData, 1200);

function normalizePage(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
}

app.get("/api/tools", (req, res) => {
    const cat = String(req.query.cat || "all").toLowerCase();
    const page = normalizePage(req.query.page);
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const offset = (page - 1) * limit;

    let query = "SELECT id, name, cat, badge, description, url FROM tools WHERE 1=1";
    let countQuery = "SELECT COUNT(*) AS total FROM tools WHERE 1=1";
    const params = [];
    const countParams = [];

    if (cat && cat !== "all" && VALID_CATS.includes(cat)) {
        query += " AND cat = ?";
        countQuery += " AND cat = ?";
        params.push(cat);
        countParams.push(cat);
    }

    query += " ORDER BY id DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    dbConnection.query(countQuery, countParams, (countErr, countResult) => {
        if (countErr) return res.status(500).json({ error: "Database error" });

        dbConnection.query(query, params, (err, results) => {
            if (err) return res.status(500).json({ error: "Database error" });

            res.json({
                tools: results.map(tool => ({
                    id: tool.id,
                    name: tool.name,
                    cat: tool.cat,
                    badge: tool.badge,
                    description: tool.description || "",
                    url: tool.url
                })),
                total: countResult[0].total
            });
        });
    });
});

app.get("/api/tools/count", (req, res) => {
    dbConnection.query("SELECT COUNT(*) AS count FROM tools", (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json({ count: results[0].count });
    });
});

app.get("/admin/login", (req, res) => {
    if (req.session.isAdmin) return res.redirect("/admin/dashboard");
    res.sendFile(path.join(__dirname, "public", "admin-login.html"));
});

app.post("/admin/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) return res.redirect("/admin/login?error=1");

    dbConnection.query("SELECT * FROM admins WHERE username = ?", [username], (err, results) => {
        if (err || results.length === 0) return res.redirect("/admin/login?error=1");

        const admin = results[0];
        const storedPassword = String(admin.password || "");

        const finishLogin = (ok) => {
            if (!ok) return res.redirect("/admin/login?error=1");
            req.session.isAdmin = true;
            req.session.adminId = admin.id;
            req.session.save(saveErr => {
                if (saveErr) return res.redirect("/admin/login?error=1");
                res.redirect("/admin/dashboard");
            });
        };

        if (storedPassword.startsWith("$2")) {
            bcrypt.compare(password, storedPassword, (compareErr, match) => {
                if (compareErr) return res.redirect("/admin/login?error=1");
                finishLogin(match);
            });
            return;
        }

        finishLogin(password === storedPassword);
    });
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
    dbConnection.query("SELECT * FROM tools ORDER BY id DESC", (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(results);
    });
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

    dbConnection.query(
        "INSERT INTO tools (name, cat, badge, description, url) VALUES (?, ?, ?, ?, ?)",
        [name, cat, badge, description, url],
        err => {
            if (err) return res.redirect("/admin/dashboard?error=db");
            res.redirect("/admin/dashboard?success=1");
        }
    );
});

app.post("/admin/tools/delete/:id", (req, res) => {
    if (!req.session.isAdmin) return res.status(403).json({ error: "Forbidden" });

    const id = parseInt(req.params.id, 10);
    if (!id || Number.isNaN(id)) return res.redirect("/admin/dashboard?error=invalid");

    dbConnection.query("DELETE FROM tools WHERE id = ?", [id], err => {
        if (err) return res.redirect("/admin/dashboard?error=db");
        res.redirect("/admin/dashboard?success=deleted");
    });
});

app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
});
