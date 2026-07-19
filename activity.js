let allSnapshots = [];
let currentSnapshots = [];
let difficultyModeTimelineChart = null;

if (typeof Chart !== "undefined") {
    Chart.defaults.font.size = 14;
    Chart.defaults.color = "#ddd";
}


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
    currentSnapshots = [...allSnapshots];

    wireRangeButtons();
    redraw();

}


function wireRangeButtons() {

    document.querySelectorAll(".range-btn").forEach(btn => {

        btn.onclick = () => {

            document
                .querySelector(".range-btn.active")
                ?.classList.remove("active");

            btn.classList.add("active");

            const days = btn.dataset.days;

            currentSnapshots = filterRange(
                allSnapshots,
                days === "all" ? "all" : Number(days)
            );

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

    const labels = snapshots.map(snapshot =>
        new Date(snapshot.timestamp).toLocaleString()
    );

    const comboSpecs = [
        { key: "0|0", label: "Normal SC", color: "#3fa7ff" },
        { key: "0|1", label: "Normal HC", color: "#8ec9ff" },
        { key: "1|0", label: "Nightmare SC", color: "#f39c12" },
        { key: "1|1", label: "Nightmare HC", color: "#f5c26b" },
        { key: "2|0", label: "Hell SC", color: "#ff4d4f" },
        { key: "2|1", label: "Hell HC", color: "#c6c6c6" },
    ];

    const normalizeDifficulty = code => {
        const key = String(code);
        if (key === "3")
            return "2";
        if (key === "0" || key === "1" || key === "2")
            return key;
        return null;
    };

    const normalizeMode = code => {
        const key = String(code);
        if (key === "0" || key === "1")
            return key;
        return null;
    };

    const seriesByCombo = Object.fromEntries(
        comboSpecs.map(spec => [spec.key, []])
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

        comboSpecs.forEach(spec => {
            seriesByCombo[spec.key].push(counts[spec.key]);
        });

    });

    const datasets = comboSpecs.map(spec => ({
        label: spec.label,
        data: seriesByCombo[spec.key],
        borderColor: spec.color,
        backgroundColor: spec.color,
        fill: false,
        tension: 0.2,
        pointRadius: 2,
        pointHoverRadius: 4,
    }));

    difficultyModeTimelineChart = new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: "#ddd",
                    },
                },
                title: {
                    display: true,
                    text: "Games per Snapshot by Difficulty + Mode",
                    color: "#eee",
                },
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