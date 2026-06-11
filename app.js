Chart.defaults.font.size = 14;
Chart.defaults.color = "#ddd";

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
  const data = await loadJSONL("./data/social/2026-06.jsonl");

  const labels = data.map(d => tsLabel(d.timestamp));

  const online = data.map(d => d.totals.server_players);
  const publicPlayers = data.map(d => d.totals.public_players);
  const privatePlayers = data.map(d => d.totals.private_players_est);

  const avgPublic = data.map(d => d.metrics.avg_public_players_per_game);
  const avgPrivate = data.map(d => d.metrics.avg_private_players_per_game_est);

  const introvert = data.map(d => d.metrics.introvert_index);

  // -----------------------
  // 1. Online population
  // -----------------------
  new Chart(document.getElementById("onlineChart"), {
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

  // -----------------------
  // 2. Occupancy comparison
  // -----------------------
  new Chart(document.getElementById("occupancyChart"), {
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

  // -----------------------
  // 3. Public vs Private players
  // -----------------------
  new Chart(document.getElementById("publicChart"), {
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

  // -----------------------
  // 4. Introvert Index
  // -----------------------
  new Chart(document.getElementById("introvertChart"), {
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

      let statusText;

      if (minutesSincePrevious <= 20) {
          statusText =
              `✨ The GitHub gods are smiling upon us. Last updated ${minutesSincePrevious} minutes ago.`;
      } else if (minutesSincePrevious <= 45) {
          statusText =
              `📜 Snapshots collected approximately whenever the GitHub gods allow. Last updated ${minutesSincePrevious} minutes ago.`;
      } else if (minutesSincePrevious <= 90) {
          statusText =
              `😴 The GitHub gods appear to be napping. Last updated ${minutesSincePrevious} minutes ago.`;
      } else if (minutesSincePrevious <= 180) {
          statusText =
              `⚠️ The GitHub gods have been distracted by shiny things. Last updated ${minutesSincePrevious} minutes ago.`;
      } else {
          statusText =
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

})();