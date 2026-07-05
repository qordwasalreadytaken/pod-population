async function load() {

    const response =
        await fetch("./data/activity/activity_latest.json");

    const data =
        await response.json();

    document.getElementById("timestamp").textContent =
        "Snapshot: " +
        new Date(data.timestamp).toLocaleString();

    renderSnapshotSummary([data]);

    renderActivities(data.activities);

    renderCounts("difficulty", data.difficulty);

    renderCounts("mode", data.mode);

    renderGames(data.top_games);

    renderStats(data.interesting);

}

function renderSnapshotSummary(data) {

    if (!data.length)
        return;

    const latest = data.at(-1);

    const activities = latest.activities ?? [];
    const difficulty = latest.difficulty ?? {};
    const mode = latest.mode ?? {};

    const totalGames =
        activities.reduce((s, a) => s + a.count, 0);

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
    console.log(activities);

    activities.forEach(a => {

        const pct =
            total ? a.count / total * 100 : 0;

        html += `
        <tr>

            <td style="width:140px">
                ${icons[a.name] ?? "•"} ${a.name}
            </td>

            <td style="width:140px">

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
            <td style="width:140px;">
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

            <td style="width:140px">

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
        <p><b>${stats.public_games}</b> public games</p>

        <p><b>${stats.unique_names}</b> unique names</p>

        <p>Average name length:
           <b>${stats.average_name_length}</b></p>
    `;

}

function capitalize(str) {

    return str.charAt(0).toUpperCase() +
           str.slice(1);

}

load();