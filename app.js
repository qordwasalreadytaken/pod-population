async function loadJSONL(url) {
  const res = await fetch(url);
  const text = await res.text();

  return text
    .trim()
    .split("\n")
    .map(line => JSON.parse(line));
}

function tsLabel(ts) {
  return new Date(ts).toLocaleString();
}

(async function () {

  // 👇 change this each month or make it dynamic later
  const data = await loadJSONL("/data/social/2026-06.jsonl");

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

})();