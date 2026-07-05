async function load() {

    const response =
        await fetch("./data/activity/activity_latest.json");

    const data =
        await response.json();

    document.getElementById("timestamp").textContent =
        "Snapshot: " +
        new Date(data.timestamp).toLocaleString();

    renderActivities(data.activities);

    renderCounts("difficulty", data.difficulty);

    renderCounts("mode", data.mode);

    renderGames(data.top_games);

    renderStats(data.interesting);

}

function renderActivities(activities) {

    const icons = {

        Maps: "🗺️",
        Baal: "👹",
        Chaos: "⚔️",
        Cows: "🐄",
        Rush: "🚀",
        Trade: "💰",
        Uber: "🔥",
        DClone: "😈",
        Leveling: "📈",
        Other: "❓"

    };

    let html = "<table>";

    activities.forEach(a => {

        const icon = icons[a.name] || "•";

        html += `
            <tr>
                <td>${icon} ${a.name}</td>
                <td style="text-align:right">${a.count}</td>
            </tr>
        `;

    });

    html += "</table>";

    document.getElementById("activities").innerHTML = html;

}

function renderCounts(id, values) {

    let html = "<table>";

    Object.entries(values)
        .sort((a, b) => b[1] - a[1])
        .forEach(([name, count]) => {

            html += `
                <tr>
                    <td>${capitalize(name)}</td>
                    <td style="text-align:right">${count}</td>
                </tr>
            `;

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