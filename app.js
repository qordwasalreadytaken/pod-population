Chart.defaults.font.size = 14;
Chart.defaults.color = "#ddd";

const CHART_TITLES = {
    online: "Online Population",
    occupancy: "Average Players per Game",
    public: "Public vs Private Players",
    introvert: "Introvert Index"
};

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

function renderSummary(latest, data, rolling) {

  const totals = latest.totals;
  const metrics = latest.metrics;

  const introvertPct = (metrics.introvert_index * 100).toFixed(0);
  const publicOcc = metrics.avg_public_players_per_game?.toFixed(2);
  const privateOcc = metrics.avg_private_players_per_game_est?.toFixed(2);
  const sevenPublic = rolling.sevenDayPublicOcc.toFixed(2);
  const sevenPrivate = rolling.sevenDayPrivateOcc.toFixed(2);
  const sevenIntrovert = (rolling.sevenDayIntrovert * 100).toFixed(0);

  const el = document.getElementById("summary");


  el.innerHTML = `
    <h2>Latest Snapshot</h2>

    <p><strong>${totals.server_players}</strong> players across <strong>${totals.server_games}</strong> games.<br>
      <strong>${totals.public_players}</strong> in public games (${totals.public_games}).<br>
      Estimated <strong>${totals.private_players_est}</strong> in private games.</p>

    <p>Public avg: <strong>${publicOcc}</strong> players/game<br>
       Private avg: <strong>${privateOcc}</strong> players/game</p>

    <p>Introvert Index: <strong>${introvertPct}%</strong></p>

    <p>7-day Public avg: <strong>${sevenPublic}</strong> players/game<br>
      7-day Private avg: <strong>${sevenPrivate}</strong> players/game</p>

    <p>7-day Introvert Index: <strong>${sevenIntrovert}%</strong></p>
  `;

}

(async function () {

  // 👇 change this each month or make it dynamic later
//  const june = await loadJSONL("./data/social/2026-06.jsonl");
//  const july = await loadJSONL("./data/social/2026-07.jsonl");

// const data = [...june, ...july];

// const july = await loadJSONL("./data/social/2026-07.jsonl");


  const data = await loadJSONL("./data/social/2026-06.jsonl");

  // random reference to july
//  console.log("bananas");

  const labels = data.map(d => tsLabel(d.timestamp));

  const online = data.map(d => d.totals.server_players);
  const publicPlayers = data.map(d => d.totals.public_players);
  const privatePlayers = data.map(d => d.totals.private_players_est);

  const avgPublic = data.map(d => d.metrics.avg_public_players_per_game);
  const avgPrivate = data.map(d => d.metrics.avg_private_players_per_game_est);

  const introvert = data.map(d => d.metrics.introvert_index);

//  const sevenDayOnline = avg(last7Days.map(d => d.totals.server_players));

  // -----------------------
  // Chart configurations
  // -----------------------

  const chartConfigs = {};
  const charts = {};

  // -----------------------
  // 1. Online population
  // -----------------------
  chartConfigs.online = () => ({
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Online Players",
        data: online,
        borderColor: "cyan",
        fill: false
      }]
    }
  });

  charts.online = new Chart(
    document.getElementById("onlineChart"),
    chartConfigs.online()
  );


  // -----------------------
  // 2. Occupancy comparison
  // -----------------------
  chartConfigs.occupancy = () => ({
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Avg Public Occupancy",
          data: avgPublic,
          borderColor: "lime",
          fill: false
        },
        {
          label: "Avg Private Occupancy",
          data: avgPrivate,
          borderColor: "orange",
          fill: false
        }
      ]
    }
  });

  charts.occupancy = new Chart(
    document.getElementById("occupancyChart"),
    chartConfigs.occupancy()
  );



  // -----------------------
  // 3. Public vs Private players
  // -----------------------
  chartConfigs.public = () => ({
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Public Players",
          data: publicPlayers,
          borderColor: "yellow",
          fill: false
        },
        {
          label: "Private Players (est)",
          data: privatePlayers,
          borderColor: "red",
          fill: false
        }
      ]
    }
  });

  charts.public = new Chart(
    document.getElementById("publicChart"),
    chartConfigs.public()
  );



  // -----------------------
  // 4. Introvert Index
  // -----------------------
  chartConfigs.introvert = () => ({
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Introvert Index (higher = more solo play)",
        data: introvert,
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

  charts.introvert = new Chart(
    document.getElementById("introvertChart"),
    chartConfigs.introvert()
  );



  // -----------------------
  // Click-to-expand charts
  // -----------------------

  let expandedChart = null;
  let currentChart = null;

  const chartOrder = [
      "online",
      "occupancy",
      "public",
      "introvert"
  ];

  function average(arr) {
      return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function maximum(arr) {
      return Math.max(...arr);
  }

  function openChart(name) {

      currentChart = name;

      document.getElementById("modalTitle").textContent =
          CHART_TITLES[name];

      const stats = document.getElementById("modalStats");

      switch (name) {

          case "online": {

              stats.innerHTML = `
                  Current <strong>${online.at(-1)}</strong>
                  &nbsp;&bull;&nbsp;
                  7-day Avg <strong>${sevenDayOnline.toFixed(1)}</strong>
                  &nbsp;&bull;&nbsp;
                  Peak <strong>${maximum(online)}</strong>
                  &nbsp;&bull;&nbsp;
                  Samples <strong>${online.length}</strong>
              `;

              break;
          }

          case "occupancy": {

              stats.innerHTML = `
                  Public <strong>${avgPublic.at(-1).toFixed(2)}</strong>
                  &nbsp;&bull;&nbsp;
                  Private <strong>${avgPrivate.at(-1).toFixed(2)}</strong>
                  &nbsp;&bull;&nbsp;
                  7-day Public <strong>${sevenDayPublicOcc.toFixed(2)}</strong>
                  &nbsp;&bull;&nbsp;
                  7-day Private <strong>${sevenDayPrivateOcc.toFixed(2)}</strong>
              `;

              break;
          }

          case "public": {

              const total = publicPlayers.at(-1) + privatePlayers.at(-1);

              const pct = total
                  ? privatePlayers.at(-1) / total * 100
                  : 0;

              stats.innerHTML = `
                  Public <strong>${publicPlayers.at(-1)}</strong>
                  &nbsp;&bull;&nbsp;
                  Private <strong>${privatePlayers.at(-1)}</strong>
                  &nbsp;&bull;&nbsp;
                  ${pct.toFixed(0)}% estimated private
              `;

              break;
          }

          case "introvert": {

              stats.innerHTML = `
                  Current <strong>${(introvert.at(-1) * 100).toFixed(0)}%</strong>
                  &nbsp;&bull;&nbsp;
                  7-day Avg <strong>${(sevenDayIntrovert * 100).toFixed(0)}%</strong>
                  &nbsp;&bull;&nbsp;
                  Peak <strong>${(maximum(introvert) * 100).toFixed(0)}%</strong>
              `;

              break;
          }

      }

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

      setTimeout(() => expandedChart.resize(), 250);
  }

  document.querySelectorAll(".chart-card").forEach(card => {

      card.addEventListener("click", () => {

          card.style.transform = "scale(.97)";

          requestAnimationFrame(() => {
              card.style.transform = "";
          });

          openChart(card.dataset.chart);

      });

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

      // Esc should always close if modal is open
      if (e.key === "Escape") {
          closeChartModal();
          return;
      }

      // Don't process arrows unless a chart is open
      if (!currentChart)
          return;

      let index = chartOrder.indexOf(currentChart);

      if (e.key === "ArrowRight") {

          index = (index + 1) % chartOrder.length;
          openChart(chartOrder[index]);

      }

      if (e.key === "ArrowLeft") {

          index = (index - 1 + chartOrder.length) % chartOrder.length;
          openChart(chartOrder[index]);

      }

  });

  // -----------------------
  // 5. Summary
  // -----------------------
  if (!data || data.length === 0) {
    console.error("No data loaded");
    document.getElementById("summary").innerHTML =
      "<p>No data available yet.</p>";
    return;
  }  
  const latest = data.at(-1);
  if (!latest) {
    console.error("Latest snapshot missing");
    return;
  }

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const latestTime = new Date(latest.timestamp).getTime();

  const last7Days = data.filter(d =>
    latestTime - new Date(d.timestamp).getTime() <= sevenDaysMs
  );

  const avg = arr => {
    const clean = arr.filter(v => typeof v === "number" && !isNaN(v));
    return clean.length ? clean.reduce((s, v) => s + v, 0) / clean.length : 0;
  };

  const sevenDayPublicOcc = avg(
    last7Days.map(d => d.metrics.avg_public_players_per_game)
  );

  const sevenDayPrivateOcc = avg(
    last7Days.map(d => d.metrics.avg_private_players_per_game_est)
  );

  const sevenDayIntrovert = avg(
    last7Days.map(d => d.metrics.introvert_index)
  );

  const sevenDayOnline = avg(last7Days.map(d => d.totals.server_players));

  // -----------------------
  // 6. Last updated status
  // -----------------------

  const latestDate = new Date(latest.timestamp);

  const status = document.getElementById("status");

  if (data.length >= 2) {
      const previous = data.at(-2);

      const minutesSincePrevious = Math.round(
          (latestTime - new Date(previous.timestamp).getTime()) / 1000 / 60
      );

      let statusText = "Scheduled to update every 15 minutes. ";

      if (minutesSincePrevious <= 20) {
          statusText +=
              `✨ The GitHub gods are smiling upon us. Last updated ${minutesSincePrevious} minutes ago.`;
      } else if (minutesSincePrevious <= 45) {
          statusText +=
              `📜 Snapshots collected approximately whenever the GitHub gods allow. Last updated ${minutesSincePrevious} minutes ago.`;
      } else if (minutesSincePrevious <= 90) {
          statusText +=
              `😴 The GitHub gods appear to be napping. Last updated ${minutesSincePrevious} minutes ago.`;
      } else if (minutesSincePrevious <= 180) {
          statusText +=
              `⚠️ The GitHub gods have been distracted by shiny things. Last updated ${minutesSincePrevious} minutes ago.`;
      } else {
          statusText +=
              `🔥 Sanctuary trembles... the GitHub gods have abandoned us. Last updated ${minutesSincePrevious} minutes ago.`;
      }

      status.textContent = statusText;

  } else {
      status.textContent =
          "📡 Awaiting enough samples to judge the whims of the GitHub gods.";
  }

  renderSummary(latest, data, {
    sevenDayPublicOcc,
    sevenDayPrivateOcc,
    sevenDayIntrovert
  });


})
();