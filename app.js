Chart.defaults.font.size = 14;
Chart.defaults.color = "#ddd";

// -----------------------
// Dashboard state
// -----------------------

const charts = {};
const chartConfigs = {};

let expandedChart = null;
let currentChart = null;

let allData = [];
let currentData = [];

const chartOrder = [
    "online",
    "occupancy",
    "public",
    "introvert"
];

const CHART_TITLES = {
    online: "Online Population",
    occupancy: "Game Occupancy",
    public: "Public vs Private Players",
    introvert: "Introvert Index"
};

let currentRange = "all";

async function loadJSONL(url) {
  const res = await fetch(url);
  const text = await res.text();

  return text
    .split("\n")
    .filter(line => line.trim().length > 0)
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.error("Bad JSONL line at", i, line);
        throw e;
      }
    });
}

function tsLabel(ts) {
  return new Date(ts).toLocaleString();
}

function average(arr) {

    const clean = arr.filter(v =>
        typeof v === "number" && !isNaN(v)
    );

    if (!clean.length)
        return 0;

    return clean.reduce((a, b) => a + b, 0) / clean.length;

}

function latestTime(data) {

    return new Date(data.at(-1).timestamp);

}

function filterRange(data, days) {

    if (days === "all")
        return [...data];

    const newest = latestTime(data).getTime();

    return data.filter(d =>

        newest - new Date(d.timestamp).getTime()
        <= days * 86400000

    );

}

function buildChartData(data) {

    return {

        labels: data.map(d => tsLabel(d.timestamp)),

        online: data.map(d => d.totals.server_players),

        publicPlayers: data.map(d => d.totals.public_players),

        privatePlayers: data.map(d => d.totals.private_players_est),

        avgPublic: data.map(
            d => d.metrics.avg_public_players_per_game
        ),

        avgPrivate: data.map(
            d => d.metrics.avg_private_players_per_game_est
        ),

        introvert: data.map(
            d => d.metrics.introvert_index
        )

    };

}

function calculateRollingStats(data) {

    const latest = data.at(-1);

    const newest = new Date(latest.timestamp).getTime();

    const week = data.filter(d =>

        newest - new Date(d.timestamp).getTime()
        <= 7 * 86400000

    );

    return {

        latest,

        sevenDayPublicOcc: average(

            week.map(d =>
                d.metrics.avg_public_players_per_game
            )

        ),

        sevenDayPrivateOcc: average(

            week.map(d =>
                d.metrics.avg_private_players_per_game_est
            )

        ),

        sevenDayIntrovert: average(

            week.map(d =>
                d.metrics.introvert_index
            )

        )

    };

}

function updateStatus(data) {

    const status = document.getElementById("status");

    if (data.length < 2) {
        status.textContent =
            "📡 Awaiting enough samples to judge the whims of the GitHub gods.";
        return;
    }

    const latest = data.at(-1);
    const previous = data.at(-2);

    const minutes = Math.round(
        (
            new Date(latest.timestamp) -
            new Date(previous.timestamp)
        ) / 60000
    );

    let text = "Scheduled every 15 minutes. ";

    if (minutes <= 20)
        text +=
            `✨ The GitHub gods are smiling upon us. Last updated ${minutes} minutes ago.`;

    else if (minutes <= 45)
        text +=
            `📜 Snapshots collected approximately whenever the GitHub gods allow. Last updated ${minutes} minutes ago.`;

    else if (minutes <= 90)
        text +=
            `😴 The GitHub gods appear to be napping. Last updated ${minutes} minutes ago.`;

    else if (minutes <= 180)
        text +=
            `⚠️ The GitHub gods have been distracted by shiny things. Last updated ${minutes} minutes ago.`;

    else
        text +=
            `🔥 Sanctuary trembles... the GitHub gods have abandoned us. Last updated ${minutes} minutes ago.`;

    status.textContent = text;

}

function redrawDashboard() {

    const chartData = buildChartData(currentData);

    renderCharts(chartData);

    const rolling =
        calculateRollingStats(currentData);

    renderSummary(
        rolling.latest,
        currentData,
        rolling
    );

    updateStatus(currentData);

}

function destroyCharts() {

    Object.values(charts).forEach(chart => {

        if (chart)
            chart.destroy();

    });

}

function renderCharts(chartData) {

    // Destroy existing charts if they exist
    Object.values(charts).forEach(chart => {
        if (chart)
            chart.destroy();
    });

    chartConfigs.online = () => ({
        type: "line",
        data: {
            labels: chartData.labels,
            datasets: [{
                label: "Online Players",
                data: chartData.online,
                borderColor: "cyan",
                fill: false
            }]
        }
    });

    chartConfigs.occupancy = () => ({
        type: "line",
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: "Avg Public Occupancy",
                    data: chartData.avgPublic,
                    borderColor: "lime",
                    fill: false
                },
                {
                    label: "Avg Private Occupancy",
                    data: chartData.avgPrivate,
                    borderColor: "orange",
                    fill: false
                }
            ]
        }
    });

    chartConfigs.public = () => ({
        type: "line",
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: "Public Players",
                    data: chartData.publicPlayers,
                    borderColor: "yellow",
                    fill: false
                },
                {
                    label: "Private Players (est)",
                    data: chartData.privatePlayers,
                    borderColor: "red",
                    fill: false
                }
            ]
        }
    });

    chartConfigs.introvert = () => ({
        type: "line",
        data: {
            labels: chartData.labels,
            datasets: [{
                label: "Introvert Index",
                data: chartData.introvert,
                borderColor: "magenta",
                fill: false
            }]
        },
        options: {
            scales: {
                y: {
                    min: 0,
                    max: 1
                }
            }
        }
    });

    charts.online = new Chart(
        document.getElementById("onlineChart"),
        chartConfigs.online()
    );

    charts.occupancy = new Chart(
        document.getElementById("occupancyChart"),
        chartConfigs.occupancy()
    );

    charts.public = new Chart(
        document.getElementById("publicChart"),
        chartConfigs.public()
    );

    charts.introvert = new Chart(
        document.getElementById("introvertChart"),
        chartConfigs.introvert()
    );

    wireChartClicks();

}

function renderSummary(latest, data, rolling) {

    const totals = latest.totals;
    const metrics = latest.metrics;

    document.getElementById("summary").innerHTML = `

        <h2>Latest Snapshot
            <span class="help" title="Statistics are derived from public game listings and estimated private games.">
                ⓘ
            </span>
        </h2>
        <p>

            <strong>${totals.server_players}</strong> players
            across
            <strong>${totals.server_games}</strong> games.
            <br>
            <strong>${totals.public_players}</strong> in public games.
            <br>
            <strong>${totals.private_players_est}</strong> in private games (est).
            <br>
            Public Avg:
            <strong>${metrics.avg_public_players_per_game.toFixed(2)}</strong>  players/game

            <br>

            Private Avg:
            <strong>${metrics.avg_private_players_per_game_est.toFixed(2)}</strong>  players/game

        </p>

        <p>

            Introvert Index
            <span class="help"
                title="Estimated percentage of online players in private or solo games.">
                ⓘ 
            </span>
            <strong>

            ${(metrics.introvert_index*100).toFixed(0)}%

            </strong>

        </p>

        <hr>

        <p>

            <strong>Rolling 7-Day Average</strong>

        </p>

        <p>

            Public:
            ${rolling.sevenDayPublicOcc.toFixed(2)} players/game

            <br>

            Private:
            ${rolling.sevenDayPrivateOcc.toFixed(2)} players/game

            <br>

            Introvert:
            ${(rolling.sevenDayIntrovert*100).toFixed(0)}%

        </p>

    `;

}

function wireChartClicks() {

    document.querySelectorAll(".chart-card").forEach(card => {

        card.onclick = () => {

            card.style.transform = "scale(.97)";

            requestAnimationFrame(() => {
                card.style.transform = "";
            });

            openChart(card.dataset.chart);

        };

    });

}

function openChart(name) {

    currentChart = name;

    document.getElementById("modalTitle").textContent =
        CHART_TITLES[name];

    document.getElementById("chartModal").classList.add("show");

    if (expandedChart)
        expandedChart.destroy();

    const config = chartConfigs[name]();

    config.options ??= {};
    config.options.responsive = true;
    config.options.maintainAspectRatio = false;

    expandedChart = new Chart(
        document.getElementById("modalChart"),
        config
    );

    setTimeout(() => expandedChart.resize(), 200);

}

(async function () {

    allData = [
        ...await loadJSONL("./data/social/2026-06.jsonl"),
        ...await loadJSONL("./data/social/2026-07.jsonl")
    ];

    currentData = [...allData];

    document.querySelectorAll(".range-btn").forEach(btn => {

        btn.onclick = () => {

            document
                .querySelector(".range-btn.active")
                ?.classList.remove("active");

            btn.classList.add("active");

            currentRange = btn.dataset.days;

            currentData = filterRange(
                allData,
                currentRange === "all"
                    ? "all"
                    : Number(currentRange)
            );

            redrawDashboard();

        };

    });

    function closeChartModal() {

        document.getElementById("chartModal").classList.remove("show");

        if (expandedChart) {
            expandedChart.destroy();
            expandedChart = null;
        }

        currentChart = null;
    }

    document.getElementById("closeModal").onclick = closeChartModal;
    document.getElementById("modalChart").ondblclick = closeChartModal;

    document.getElementById("chartModal").onclick = e => {
        if (e.target.id === "chartModal")
            closeChartModal();
    };

    document.addEventListener("keydown", e => {

        if (!expandedChart)
            return;

        if (e.key === "Escape") {
            closeChartModal();
            return;
        }

        let index = chartOrder.indexOf(currentChart);

        if (e.key === "ArrowRight") {
            openChart(chartOrder[(index + 1) % chartOrder.length]);
        }

        if (e.key === "ArrowLeft") {
            openChart(chartOrder[(index + chartOrder.length - 1) % chartOrder.length]);
        }

    });    

    redrawDashboard();

})();