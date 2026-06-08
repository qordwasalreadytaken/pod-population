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
  const latest = data[data.length - 1];

  const totals = latest.totals;
  const metrics = latest.metrics;

  const introvertPct = metrics.introvert_index != null
      ? (metrics.introvert_index * 100).toFixed(0)
      : "N/A";

  const publicOcc = metrics.avg_public_players_per_game != null
      ? metrics.avg_public_players_per_game.toFixed(2)
      : "N/A";

  const privateOcc = metrics.avg_private_players_per_game_est != null
      ? metrics.avg_private_players_per_game_est.toFixed(2)
      : "N/A";

  document.getElementById("summary").innerHTML = `
      <h2>Latest Snapshot</h2>

      <p>
          <strong>${totals.server_players}</strong> players were active across
          <strong>${totals.server_games}</strong> games.
      </p>

      <p>
          <strong>${totals.public_players}</strong> players were visible in
          <strong>${totals.public_games}</strong> public games.
      </p>

      <p>
          This suggests approximately
          <strong>${totals.private_players_est}</strong> players were in
          <strong>${totals.private_games_est}</strong> private games.
      </p>

      <p>
          Public games averaged <strong>${publicOcc}</strong> players,
          while private games averaged an estimated
          <strong>${privateOcc}</strong> players.
      </p>

      <p>
          The current <strong>Introvert Index™</strong> is
          <strong>${introvertPct}%</strong>.
      </p>
  `;
let verdict;

if (privateOcc === "N/A") {
    verdict = "Insufficient data to estimate private group sizes.";
} else {
    const p = parseFloat(privateOcc);

    if (p < 1.2) {
        verdict = "PoD currently appears to be a predominantly solo experience.";
    } else if (p < 1.8) {
        verdict = "Most private games appear to involve duos or very small groups.";
    } else if (p < 2.5) {
        verdict = "Private play appears to favor small parties.";
    } else {
        verdict = "PoD currently appears to be experiencing significant group play.";
    }
}

document.getElementById("summary").innerHTML += `
    <p><em>${verdict}</em></p>
`;

})();