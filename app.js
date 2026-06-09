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

function renderSummary(latest, data) {

  const totals = latest.totals;
  const metrics = latest.metrics;

  const introvertPct = (metrics.introvert_index * 100).toFixed(0);
  const publicOcc = metrics.avg_public_players_per_game?.toFixed(2);
  const privateOcc = metrics.avg_private_players_per_game_est?.toFixed(2);

  const el = document.getElementById("summary");

  el.innerHTML = `
    <h2>Latest Snapshot</h2>

    <p><strong>${totals.server_players}</strong> players across <strong>${totals.server_games}</strong> games.</p>

    <p><strong>${totals.public_players}</strong> in public games (${totals.public_games}).</p>

    <p>Estimated <strong>${totals.private_players_est}</strong> in private games.</p>

    <p>Public avg: <strong>${publicOcc}</strong> players/game<br>
       Private avg: <strong>${privateOcc}</strong> players/game</p>

    <p>Introvert Index: <strong>${introvertPct}%</strong></p>
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
  renderSummary(latest, data);

})();