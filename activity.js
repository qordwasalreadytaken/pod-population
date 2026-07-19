let allSnapshots = [];
let currentSnapshots = [];
let difficultyModeTimelineChart = null;
let difficultyModeTimelineExpandedChart = null;
let difficultyModeInteractionsWired = false;
let currentRange = "all";
let liveSnapshot = null;
let includeLiveSnapshot = false;

const POD_API_BASE = "https://beta.pathofdiablo.com/api";
const POD_API_OPEN_GAMES_URL = `${POD_API_BASE}/open-games`;

const ACTIVITY_KEYWORDS = {
    Maps: ["map", "maps", "mapping", "maap"],
    Baal: ["baal"],
    Chaos: ["chaos", "cs", "i dia u", "dia", "arcane"],
    Cows: ["cow", "cows", "bovine"],
    Rush: ["rush", "rushing"],
    "Misc. Public MF Runs": [
        "asd", "asdff", "mf", "derp", "nico", "gord", "aa",
        "run", "123", "hielitos", "ted", "mmk", "aaa", "meph",
    ],
    Leveling: [
        "trist", "tomb", "walk", "exp", "ct", "act", "norm",
        "lv", "leveli", "start", "andy", "andar", "den", "a1",
        "a2", "a3", "a4", "a5", "act1", "act2", "act3", "act4",
        "act5", "anci",
    ],
    Trade: [
        "trade", "bring", "iso", "wug", "wuw", "ft", "torch",
        "n", "swap", "lmk", "for", "buy",
    ],
    Uber: ["uber", "ubers"],
    DClone: ["dclone", "clone"],
};

if (typeof Chart !== "undefined") {
    Chart.defaults.font.size = 14;
    Chart.defaults.color = "#ddd";
}

const DIFFICULTY_MODE_COMBO_SPECS = [
    { key: "0|0", label: "Normal SC", color: "#3fa7ff" },
    { key: "0|1", label: "Normal HC", color: "#8ec9ff" },
    { key: "1|0", label: "Nightmare SC", color: "#f39c12" },
    { key: "1|1", label: "Nightmare HC", color: "#f5c26b" },
    { key: "2|0", label: "Hell SC", color: "#ff4d4f" },
    { key: "2|1", label: "Hell HC", color: "#c6c6c6" },
];


async function load() {

    let data = [];

    try {
        const response =
            await fetch("./data/activity/activity_history.json");

        data = await response.json();
    } catch (error) {
        const response =
            await fetch("./data/activity/activity_latest.json");

        const latest = await response.json();
        data = latest?.timestamp ? [latest] : [];
    }

    allSnapshots = Array.isArray(data) ? data : [];

    wireRangeButtons();
    wireLiveButton();
    wireDifficultyModeTimelineInteractions();
    refreshCurrentSnapshots();
    redraw();

}


function wireRangeButtons() {

    document.querySelectorAll(".range-btn").forEach(btn => {

        btn.onclick = () => {

            document
                .querySelector(".range-btn.active")
                ?.classList.remove("active");

            btn.classList.add("active");

            currentRange = btn.dataset.days;

            refreshCurrentSnapshots();

            redraw();

        };

    });

}


function filterRange(data, days) {

    if (days === "all")
        return [...data];

    if (!data.length)
        return [];

    const newest =
        new Date(data.at(-1).timestamp).getTime();

    return data.filter(d =>
        newest - new Date(d.timestamp).getTime()
        <= days * 86400000
    );

}

function upsertLiveSnapshot(data, snapshot) {

    if (!snapshot?.timestamp)
        return [...data];

    const filtered = data.filter(
        s => s.timestamp !== snapshot.timestamp
    );

    filtered.push(snapshot);

    filtered.sort(
        (a, b) =>
            new Date(a.timestamp) - new Date(b.timestamp)
    );

    return filtered;

}

function refreshCurrentSnapshots() {

    const baseSnapshots = filterRange(
        allSnapshots,
        currentRange === "all"
            ? "all"
            : Number(currentRange)
    );

    currentSnapshots = includeLiveSnapshot && liveSnapshot
        ? upsertLiveSnapshot(baseSnapshots, liveSnapshot)
        : baseSnapshots;

}


function mergeObjectCounts(snapshots, field) {

    const merged = {};

    snapshots.forEach(snapshot => {

        const values = snapshot[field] ?? {};

        Object.entries(values).forEach(([key, count]) => {
            merged[key] = (merged[key] ?? 0) + Number(count || 0);
        });

    });

    return merged;

}


function mergeArrayCounts(snapshots, field, nameKey = "name") {

    const merged = {};

    snapshots.forEach(snapshot => {

        const values = snapshot[field] ?? [];

        values.forEach(item => {
            const key = item?.[nameKey];
            if (!key)
                return;

            merged[key] = (merged[key] ?? 0) + Number(item.count || 0);
        });

    });

    return Object.entries(merged)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

}


function average(arr) {

    const clean = arr.filter(v =>
        typeof v === "number" && !isNaN(v)
    );

    if (!clean.length)
        return 0;

    return clean.reduce((a, b) => a + b, 0) / clean.length;

}


function aggregateInteresting(snapshots) {

    const publicGamesPerSnapshot =
        snapshots.map(s => s.interesting?.public_games ?? 0);

    const uniqueNamesPerSnapshot =
        snapshots.map(s => s.interesting?.unique_names ?? 0);

    const avgNameLengthPerSnapshot =
        snapshots.map(s => s.interesting?.average_name_length ?? 0);

    return {
        snapshot_count: snapshots.length,
        total_public_games_observed:
            publicGamesPerSnapshot.reduce((sum, n) => sum + n, 0),
        avg_public_games_per_snapshot: Number(
            average(publicGamesPerSnapshot).toFixed(2)
        ),
        avg_unique_names: Number(
            average(uniqueNamesPerSnapshot).toFixed(2)
        ),
        avg_name_length: Number(
            average(avgNameLengthPerSnapshot).toFixed(2)
        ),
    };

}

function normalizeGameName(name) {

    if (!name)
        return null;

    let value = String(name).trim().toLowerCase();

    value = value.replace(/\s+/g, " ");
    value = value.replace(/([a-z]+)\d+\b/g, "$1");

    return value || null;

}

function tokenizeGameName(name) {

    if (!name)
        return [];

    let value = String(name).toLowerCase();

    value = value.replace(/([a-z]+)\d+\b/g, "$1");
    value = value.replace(/[^a-z0-9]+/g, " ");
    value = value.replace(/\s+/g, " ").trim();

    const tokens = [];

    value.split(" ").forEach(token => {

        if (!token)
            return;

        tokens.push(token);

        ["n", "h", "nm"].forEach(prefix => {
            if (token.startsWith(prefix) && token.length > prefix.length + 2)
                tokens.push(token.slice(prefix.length));
        });

    });

    return [...new Set(tokens)];

}

function classifyActivityName(name) {

    const tokens = tokenizeGameName(name);

    for (const [activity, keywords] of Object.entries(ACTIVITY_KEYWORDS)) {

        for (const token of tokens) {

            for (const keyword of keywords) {

                if (keyword.length <= 2) {
                    if (token === keyword)
                        return [activity, keyword];
                } else if (token.includes(keyword)) {
                    return [activity, keyword];
                }

            }

        }

    }

    return ["Other", null];

}

function flattenOpenGames(rawOpenGames) {

    const openGames = [];

    (rawOpenGames || []).forEach(item => {

        if (item && typeof item === "object" && !Array.isArray(item)) {
            openGames.push(item);
            return;
        }

        if (Array.isArray(item)) {
            item.forEach(entry => {
                if (entry && typeof entry === "object")
                    openGames.push(entry);
            });
        }

    });

    return openGames;

}

function incrementCount(store, key, amount = 1) {

    store[key] = (store[key] ?? 0) + amount;

}

function toSortedCountArray(store, limit = Number.POSITIVE_INFINITY) {

    return Object.entries(store)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, count]) => ({ name, count }));

}

function buildLiveActivitySnapshot(rawOpenGames) {

    const games = flattenOpenGames(rawOpenGames);

    const difficulty = {};
    const mode = {};
    const difficultyMode = {};
    const activities = {};
    const names = {};

    let publicGames = 0;

    games.forEach(game => {

        if (!game || typeof game !== "object")
            return;

        publicGames += 1;

        const rawDifficulty = Number(game.diff);
        const rawMode = Number(game.mode);

        const normalizedDifficulty = rawDifficulty === 3
            ? 2
            : rawDifficulty;

        const difficultyKey = [0, 1, 2].includes(normalizedDifficulty)
            ? String(normalizedDifficulty)
            : "null";

        const modeKey = [0, 1].includes(rawMode)
            ? String(rawMode)
            : "null";

        incrementCount(difficulty, difficultyKey, 1);
        incrementCount(mode, modeKey, 1);
        incrementCount(difficultyMode, `${difficultyKey}|${modeKey}`, 1);

        const normalizedName = normalizeGameName(game.name);

        if (!normalizedName)
            return;

        incrementCount(names, normalizedName, 1);

        const [activity] = classifyActivityName(normalizedName);
        incrementCount(activities, activity, 1);

    });

    const uniqueNames = Object.keys(names);
    const averageNameLength = uniqueNames.length
        ? Number(
            (
                uniqueNames.reduce((sum, name) => sum + name.length, 0)
                / uniqueNames.length
            ).toFixed(2)
        )
        : 0;

    return {
        timestamp: new Date().toISOString(),
        difficulty,
        mode,
        difficulty_mode: difficultyMode,
        activities: toSortedCountArray(activities),
        top_games: toSortedCountArray(names, 15),
        interesting: {
            unique_names: uniqueNames.length,
            public_games: publicGames,
            average_name_length: averageNameLength,
        },
        live: true,
    };

}

async function fetchJSON(url) {

    const response = await fetch(url);

    if (!response.ok)
        throw new Error(`HTTP ${response.status} for ${url}`);

    return response.json();

}

async function fetchLiveActivitySnapshot() {

    const openGames = await fetchJSON(POD_API_OPEN_GAMES_URL);
    return buildLiveActivitySnapshot(openGames);

}

function setLiveStatus(text) {

    const status = document.getElementById("liveStatus");

    if (status)
        status.textContent = text;

}

function wireLiveButton() {

    const button = document.getElementById("liveNowBtn");

    if (!button)
        return;

    button.onclick = async () => {

        button.disabled = true;
        setLiveStatus("Fetching live activity snapshot...");

        try {
            liveSnapshot = await fetchLiveActivitySnapshot();
            includeLiveSnapshot = true;

            refreshCurrentSnapshots();
            redraw();

            setLiveStatus(
                `Live point added at ${new Date(liveSnapshot.timestamp).toLocaleTimeString()}.`
            );
        } catch (error) {
            console.error("Live activity snapshot failed", error);
            setLiveStatus(
                "Live fetch failed (likely API/CORS/network)."
            );
        } finally {
            button.disabled = false;
        }

    };

}


function redraw() {

    const timestamp = document.getElementById("timestamp");

    if (!currentSnapshots.length) {
        timestamp.textContent = "No data found for selected range.";
        document.getElementById("rangeStatus").textContent = "";
        document.getElementById("snapshotSummary").innerHTML = "No data.";
        document.getElementById("activities").innerHTML = "";
        document.getElementById("difficulty").innerHTML = "";
        document.getElementById("mode").innerHTML = "";
        document.getElementById("difficultyMode").innerHTML = "";
        document.getElementById("games").innerHTML = "";
        document.getElementById("stats").innerHTML = "";
        renderDifficultyModeTimeline([]);
        closeDifficultyModeModal();
        return;
    }

    const latest = currentSnapshots.at(-1);
    const first = currentSnapshots.at(0);

    timestamp.textContent =
        "Latest snapshot in range: " +
        new Date(latest.timestamp).toLocaleString();

    document.getElementById("rangeStatus").textContent =
        `Showing ${currentSnapshots.length} snapshots from ${new Date(first.timestamp).toLocaleDateString()} to ${new Date(latest.timestamp).toLocaleDateString()}.`;

    const difficulty = mergeObjectCounts(currentSnapshots, "difficulty");
    const mode = mergeObjectCounts(currentSnapshots, "mode");
    const difficultyMode = mergeObjectCounts(
        currentSnapshots,
        "difficulty_mode"
    );
    const activities = mergeArrayCounts(currentSnapshots, "activities");
    const games = mergeArrayCounts(currentSnapshots, "top_games");
    const interesting = aggregateInteresting(currentSnapshots);

    renderSnapshotSummary(currentSnapshots, activities, difficulty, mode);
    renderActivities(activities);
    renderCounts("difficulty", difficulty);
    renderCounts("mode", mode);
    renderDifficultyMode(difficultyMode);
    renderDifficultyModeTimeline(currentSnapshots);
    renderGames(games.slice(0, 10));
    renderStats(interesting);

}

function renderDifficultyModeTimeline(snapshots) {

    const canvas = document.getElementById("difficultyModeTimelineChart");

    if (!canvas || typeof Chart === "undefined")
        return;

    if (difficultyModeTimelineChart) {
        difficultyModeTimelineChart.destroy();
        difficultyModeTimelineChart = null;
    }

    if (!snapshots.length) {
        return;
    }

    difficultyModeTimelineChart = createDifficultyModeTimelineChart(
        canvas,
        snapshots,
        {
            title: "Games per Snapshot by Difficulty + Mode",
            pointRadius: 2,
            pointHoverRadius: 4,
            maintainAspectRatio: false,
        }
    );

}

function normalizeDifficulty(code) {
    const key = String(code);
    if (key === "3")
        return "2";
    if (key === "0" || key === "1" || key === "2")
        return key;
    return null;
}

function normalizeMode(code) {
    const key = String(code);
    if (key === "0" || key === "1")
        return key;
    return null;
}

function buildDifficultyModeTimelineData(snapshots) {

    const labels = snapshots.map(snapshot =>
        new Date(snapshot.timestamp).toLocaleString()
    );

    const seriesByCombo = Object.fromEntries(
        DIFFICULTY_MODE_COMBO_SPECS.map(spec => [spec.key, []])
    );

    snapshots.forEach(snapshot => {

        const counts = {
            "0|0": 0,
            "0|1": 0,
            "1|0": 0,
            "1|1": 0,
            "2|0": 0,
            "2|1": 0,
        };

        const difficultyMode = snapshot.difficulty_mode ?? {};

        Object.entries(difficultyMode).forEach(([key, value]) => {

            const [difficultyCode, modeCode] =
                String(key).split("|");

            const difficulty = normalizeDifficulty(difficultyCode);
            const mode = normalizeMode(modeCode);

            if (!difficulty || !mode)
                return;

            const comboKey = `${difficulty}|${mode}`;

            if (comboKey in counts)
                counts[comboKey] += Number(value || 0);

        });

        DIFFICULTY_MODE_COMBO_SPECS.forEach(spec => {
            seriesByCombo[spec.key].push(counts[spec.key]);
        });

    });

    const datasets = DIFFICULTY_MODE_COMBO_SPECS.map(spec => ({
        label: spec.label,
        data: seriesByCombo[spec.key],
        borderColor: spec.color,
        backgroundColor: spec.color,
        fill: false,
        tension: 0.2,
    }));

    return { labels, datasets };

}

function createDifficultyModeTimelineChart(canvas, snapshots, options = {}) {

    const { labels, datasets } =
        buildDifficultyModeTimelineData(snapshots);

    const pointRadius = options.pointRadius ?? 2;
    const pointHoverRadius = options.pointHoverRadius ?? 4;
    const title = options.title ?? "Games per Snapshot by Difficulty + Mode";
    const maintainAspectRatio = options.maintainAspectRatio ?? false;

    const tunedDatasets = datasets.map(dataset => ({
        ...dataset,
        pointRadius,
        pointHoverRadius,
    }));

    return new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: tunedDatasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio,
            plugins: {
                legend: {
                    labels: {
                        color: "#ddd",
                    },
                    onClick(event, legendItem, legend) {
                        const chart = legend.chart;
                        const index = legendItem.datasetIndex;
                        const meta = chart.getDatasetMeta(index);

                        meta.hidden = meta.hidden === null
                            ? !chart.data.datasets[index].hidden
                            : null;

                        chart.update();
                    },
                },
                title: {
                    display: true,
                    text: title,
                    color: "#eee",
                },
                tooltip: {
                    mode: "index",
                    intersect: false,
                },
            },
            interaction: {
                mode: "nearest",
                axis: "x",
                intersect: false,
            },
            scales: {
                x: {
                    ticks: {
                        color: "#aaa",
                        maxRotation: 45,
                        minRotation: 45,
                    },
                    grid: {
                        color: "rgba(255, 255, 255, 0.08)",
                    },
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "#aaa",
                    },
                    grid: {
                        color: "rgba(255, 255, 255, 0.08)",
                    },
                },
            },
        },
    });

}

function wireDifficultyModeTimelineInteractions() {

    if (difficultyModeInteractionsWired)
        return;

    difficultyModeInteractionsWired = true;

    const chartCard =
        document.getElementById("difficultyModeChartCard");

    const modal =
        document.getElementById("difficultyModeModal");

    const closeBtn =
        document.getElementById("closeDifficultyModeModal");

    const modalCanvas =
        document.getElementById("difficultyModeTimelineModalChart");

    chartCard?.addEventListener("click", openDifficultyModeModal);
    closeBtn?.addEventListener("click", closeDifficultyModeModal);
    modalCanvas?.addEventListener("dblclick", closeDifficultyModeModal);

    modal?.addEventListener("click", event => {
        if (event.target === modal)
            closeDifficultyModeModal();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape")
            closeDifficultyModeModal();
    });

}

function openDifficultyModeModal() {

    if (!currentSnapshots.length)
        return;

    const modal = document.getElementById("difficultyModeModal");
    const stats = document.getElementById("difficultyModeModalStats");
    const canvas = document.getElementById("difficultyModeTimelineModalChart");

    if (!modal || !stats || !canvas || typeof Chart === "undefined")
        return;

    stats.textContent =
        `${currentSnapshots.length} snapshots in current range. ` +
        "Click legend labels to toggle series. Press Esc to close.";

    modal.classList.add("show");

    if (difficultyModeTimelineExpandedChart)
        difficultyModeTimelineExpandedChart.destroy();

    difficultyModeTimelineExpandedChart =
        createDifficultyModeTimelineChart(canvas, currentSnapshots, {
            title: "Difficulty + Mode Over Time (Expanded)",
            pointRadius: 3,
            pointHoverRadius: 5,
            maintainAspectRatio: false,
        });

    setTimeout(() => difficultyModeTimelineExpandedChart?.resize(), 200);

}

function closeDifficultyModeModal() {

    const modal = document.getElementById("difficultyModeModal");
    modal?.classList.remove("show");

    if (difficultyModeTimelineExpandedChart) {
        difficultyModeTimelineExpandedChart.destroy();
        difficultyModeTimelineExpandedChart = null;
    }

}

function renderDifficultyMode(values) {

    const normalizeDifficulty = code => {
        const key = String(code);
        if (key === "3")
            return "2";
        if (key === "0" || key === "1" || key === "2")
            return key;
        return "null";
    };

    const normalizeMode = code => {
        const key = String(code);
        if (key === "0" || key === "1")
            return key;
        return "null";
    };

    const matrix = {
        "0": { "0": 0, "1": 0 },
        "1": { "0": 0, "1": 0 },
        "2": { "0": 0, "1": 0 },
    };

    Object.entries(values || {}).forEach(([key, count]) => {

        const [difficultyCode, modeCode] =
            String(key).split("|");

        const difficulty =
            normalizeDifficulty(difficultyCode);

        const mode =
            normalizeMode(modeCode);

        if (!matrix[difficulty] || mode === "null")
            return;

        matrix[difficulty][mode] += Number(count || 0);

    });

    const totalKnown =
        Object.values(matrix).reduce(
            (sum, modes) => sum + modes["0"] + modes["1"],
            0
        );

    if (!totalKnown) {
        document.getElementById("difficultyMode").innerHTML = `
            <div class="muted">
                Difficulty+mode combo data is not available yet.
                Run <b>generate-activity.py</b> to populate it.
            </div>
        `;
        return;
    }

    const rows = [
        { code: "0", name: "Normal" },
        { code: "1", name: "Nightmare" },
        { code: "2", name: "Hell" },
    ];

    let html = "<div class='dist-grid'>";

    rows.forEach(row => {

        const sc = matrix[row.code]["0"];
        const hc = matrix[row.code]["1"];

        const scPct = totalKnown ? (sc / totalKnown * 100) : 0;
        const hcPct = totalKnown ? (hc / totalKnown * 100) : 0;

        html += `
            <div class="dist-row">
                <div class="dist-label">${row.name}</div>

                <div class="dist-bars">
                    <div class="dist-segment">
                        <div class="dist-segment-label">SC</div>
                        <div class="mini-bar">
                            <div
                                class="mini-bar-fill"
                                style="
                                    width:${scPct}%;
                                    background:#3fa7ff;
                                ">
                            </div>
                        </div>
                        <div class="dist-segment-value">
                            ${sc} (${scPct.toFixed(1)}%)
                        </div>
                    </div>

                    <div class="dist-segment">
                        <div class="dist-segment-label">HC</div>
                        <div class="mini-bar">
                            <div
                                class="mini-bar-fill"
                                style="
                                    width:${hcPct}%;
                                    background:#9e9e9e;
                                ">
                            </div>
                        </div>
                        <div class="dist-segment-value">
                            ${hc} (${hcPct.toFixed(1)}%)
                        </div>
                    </div>
                </div>
            </div>
        `;

    });

    html += `
        </div>
        <div class="dist-note">
            Percentages are across all known difficulty+mode games in the selected range.
        </div>
    `;

    document.getElementById("difficultyMode").innerHTML = html;
}

function renderSnapshotSummary(snapshots, activities, difficulty, mode) {

    if (!snapshots.length)
        return;

    const totalGames =
        activities.reduce((s, a) => s + Number(a.count || 0), 0);

    if (!totalGames) {
        document.getElementById("snapshotSummary").innerHTML =
            "No public games in selected range.";
        return;
    }

    const topActivity =
        [...activities].sort((a, b) => b.count - a.count)[0];

    const topDifficulty =
        Object.entries(difficulty)
            .sort((a, b) => b[1] - a[1])[0];

    const topMode =
        Object.entries(mode)
            .sort((a, b) => b[1] - a[1])[0];

    const difficultyNames = {
        0: "Normal",
        1: "Nightmare",
        2: "Hell"
    };

    const modeNames = {
        0: "Softcore",
        1: "Hardcore"
    };

    const spanHours =
        (
            new Date(snapshots.at(-1).timestamp) -
            new Date(snapshots.at(0).timestamp)
        ) / 3600000;

    document.getElementById("snapshotSummary").innerHTML = `
        <div class="snapshot-line">
            <b>${topActivity.name}</b> is the most common game activity
            (${(topActivity.count / totalGames * 100).toFixed(0)}%)
            &nbsp;&nbsp;•&nbsp;&nbsp;
            <b>${difficultyNames[topDifficulty[0]]}</b>
            accounts for
            ${(topDifficulty[1] / totalGames * 100).toFixed(0)}%
            of games.
        </div>

        <div class="snapshot-line">
            <b>${modeNames[topMode[0]]}</b>
            accounts for
            ${(topMode[1] / totalGames * 100).toFixed(0)}%
            of games.
            &nbsp;&nbsp;•&nbsp;&nbsp;
            <b>${totalGames}</b> public games observed.
            &nbsp;&nbsp;•&nbsp;&nbsp;
            <b>${spanHours.toFixed(1)}h</b> covered.
        </div>
    `;
}

function renderActivities(activities) {

    const icons = {
        Maps: "🗺️",
        Chaos: "⚔️",
        Baal: "👹",
        Cows: "🐄",
        Rush: "🚀",
        Trade: "💰",
        Uber: "🔥",
        DClone: "😈",
        Leveling: "📈",
        Uncategorized: "❓"
    };

    const colors = {
        Maps: "#00c853",
        Chaos: "#d32f2f",
        Baal: "#7b1fa2",
        Cows: "#8d6e63",
        Rush: "#1976d2",
        Trade: "#ff9800",
        Uber: "#e53935",
        DClone: "#424242",
        Leveling: "#43a047",
        Uncategorized: "#777"
    };

    const total =
        activities.reduce((s, a) => s + a.count, 0);

    let html = "<table class='count-table'>";

    activities.sort((a, b) => b.count - a.count);

    activities.forEach(a => {

        const pct =
            total ? a.count / total * 100 : 0;

        html += `
        <tr>

            <td>
<!--                ${icons[a.name] ?? "•"} ${a.name}-->
                ${a.name}
            </td>

            <td>

                <div class="mini-bar">

                    <div
                        class="mini-bar-fill"
                        style="
                            width:${pct}%;
                            background:${colors[a.name] ?? "#888"};
                        ">
                    </div>

                </div>

            </td>

            <td style="text-align:right; white-space:nowrap">

                ${a.count}
                <span class="muted">
                    (${pct.toFixed(1)}%)
                </span>

            </td>

        </tr>
        `;

    });

    html += "</table>";

    document.getElementById("activities").innerHTML =
        html;

}

function renderCounts(id, values) {

    const labels = {
        difficulty: {
            "0": { name: "Normal", color: "#5cb85c" },
            "1": { name: "Nightmare", color: "#f0ad4e" },
            "2": { name: "Hell", color: "#d9534f" },
            "null": { name: "Unknown", color: "black" },
        },
        mode: {
            "0": { name: "Softcore", color: "#5bc0de" },
            "1": { name: "Hardcore", color: "#777" },
            "null": { name: "Unknown", color: "black" },
        }
    };

    const order = {
        difficulty: ["0", "1", "2", "null"],
        mode: ["0", "1", "null"]
    };

    let entries = Object.entries(values);

    if (order[id]) {
        entries.sort(
            (a, b) =>
                order[id].indexOf(a[0]) -
                order[id].indexOf(b[0])
        );
    } else {
        entries.sort((a, b) => b[1] - a[1]);
    }

    const total = entries.reduce((s, [, c]) => s + c, 0);

    let html = "<table class='count-table'>";

    entries.forEach(([key, count]) => {

        const info =
            labels[id]?.[key] ??
            {
                name: capitalize(key),
                color: "#888"
            };

        const pct = total
            ? (count / total * 100)
            : 0;

        html += `
        <tr>
            <td>
                <span style="
                    display:inline-block;
                    width:10px;
                    height:10px;
                    border-radius:50%;
                    background:${info.color};
                    margin-right:6px;
                "></span>

                ${info.name}
            </td>

            <td>

                <div class="mini-bar">

                    <div class="mini-bar-fill"
                         style="
                            width:${pct}%;
                            background:${info.color};
                         ">
                    </div>

                </div>

            </td>

            <td style="text-align:right; white-space:nowrap;">

                ${count}
                <span class="muted">
                    (${pct.toFixed(1)}%)
                </span>

            </td>

        </tr>`;
    });

    html += "</table>";

    document.getElementById(id).innerHTML = html;
}

function renderGames(games) {

    let html =
        "<tr><th>Name</th><th>Games</th></tr>";

    games.forEach(g => {

        html += `
            <tr>
                <td>${g.name}</td>
                <td style="text-align:right">${g.count}</td>
            </tr>
        `;

    });

    document.getElementById("games").innerHTML = html;

}

function renderStats(stats) {

    document.getElementById("stats").innerHTML = `
          <p><b>${stats.snapshot_count}</b> snapshots in selected range</p>

          <p><b>${stats.total_public_games_observed}</b> total public games observed</p>

          <p>Average public games per snapshot:
              <b>${stats.avg_public_games_per_snapshot}</b></p>

<!--          <p>Average unique names per snapshot:
              <b>${stats.avg_unique_names}</b></p> -->

        <p>Average name length:
              <b>${stats.avg_name_length}</b></p>
    `;

}

function capitalize(str) {

    return str.charAt(0).toUpperCase() +
           str.slice(1);

}

load();