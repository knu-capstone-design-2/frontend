// dashboard.js

let hostChart, containerChart;

document.addEventListener('DOMContentLoaded', () => {
  fetch('host.json')
    .then(res => res.json())
    .then(hosts => {
      fetch('container.json')
        .then(res => res.json())
        .then(containers => {
          // 1. Usage charts
          initializeChart('hostChart', hosts, 'cpu', 'host');
          setupToggleButtons(hosts, 'host');
          initializeChart('containerChart', containers, 'cpu', 'container');
          setupToggleButtons(containers, 'container');

          // 2. Summary cards
          renderSummary(hosts, containers);

          // 3. Network charts (host.json만 사용)
          initializeNetworkChart(hosts);
          initializeNetworkSpeedChart(hosts);
        });
    });
});

function renderSummary(hostData, containerData) {
  // Top 3 hosts by interface speed
  const hostSpeeds = hostData
    .map(h => ({
      name:  h.hostName,
      speed: (parseInt(h.network.eth0_0.speedbps) + parseInt(h.network.wlan0_1.speedbps)) / 1e6
    }))
    .sort((a, b) => b.speed - a.speed)
    .slice(0, 3);

  hostSpeeds.forEach(h => {
    const li = document.createElement('li');
    li.textContent = `${h.name} - ${h.speed.toFixed(0)} Mbps`;
    document.getElementById('topSpeedHosts').appendChild(li);
  });

  // Top 3 containers by interface speed
  const contSpeeds = containerData
    .map(c => ({
      name:  c.containerName,
      speed: c.network.eth0.speedBps / 1e6
    }))
    .sort((a, b) => b.speed - a.speed)
    .slice(0, 3);

  contSpeeds.forEach(c => {
    const li = document.createElement('li');
    li.textContent = `${c.name} - ${c.speed.toFixed(0)} Mbps`;
    document.getElementById('topSpeedContainers').appendChild(li);
  });

  // Under-resourced: top 3 by CPU usage
  const combined = [];

  hostData.forEach(h => combined.push({
    name:   h.hostName,
    cpu:    h.cpuUsagePercent,
    memory: (h.memoryUsedBytes / h.memoryTotalBytes) * 100,
    disk:   (h.diskUsedBytes     / h.diskTotalBytes)   * 100
  }));

  containerData.forEach(c => combined.push({
    name:   c.containerName,
    cpu:    c.cpuUsagePercent,
    memory: (c.memoryUsedBytes / c.memoryTotalBytes) * 100,
    disk:   ((c.diskReadBytes + c.diskWriteBytes) /
             (c.diskReadBytes + c.diskWriteBytes + 1)) * 100
  }));

  combined
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, 3)
    .forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.name}</td>
        <td>${item.cpu.toFixed(0)}%</td>
        <td>${item.memory.toFixed(0)}%</td>
        <td>${item.disk.toFixed(0)}%</td>
      `;
      document.querySelector('#underResourcedTable tbody').appendChild(tr);
    });
}

// Usage chart helpers
function initializeChart(canvasId, data, type, target) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const cd  = prepareChartData(data, type, target);
  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels:   cd.labels,
      datasets: [{
        data: cd.values,
        backgroundColor: '#6a5acd',
        borderRadius: 10,
        barThickness: 20
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true, grid: { color: '#eee' } },
        x: { grid: { color: '#eee' } }
      },
      plugins: { legend: { display: false } }
    }
  });
  if (target === 'host') hostChart = chart;
  else containerChart = chart;
}

function setupToggleButtons(data, target) {
  document.querySelectorAll(`.toggle-buttons.${target} .toggle`).forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(`.toggle-buttons.${target} .toggle`)
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const type  = btn.getAttribute('data-type');
      const chart = (target === 'host') ? hostChart : containerChart;
      const cd    = prepareChartData(data, type, target);

      chart.data.labels           = cd.labels;
      chart.data.datasets[0].data = cd.values;
      chart.update();
    });
  });
}

function prepareChartData(data, type, target) {
  const labels = (target === 'host')
    ? data.map(h => h.hostName)
    : data.map(c => c.containerName);

  let values = [];
  if (type === 'cpu') {
    values = data.map(x => x.cpuUsagePercent);
  } else if (type === 'memory') {
    values = data.map(x => ((x.memoryUsedBytes / x.memoryTotalBytes) * 100).toFixed(1));
  } else if (type === 'disk') {
    values = data.map(x => (((x.diskReadBytes + x.diskWriteBytes) /
                             (x.diskReadBytes + x.diskWriteBytes + 1)) * 100).toFixed(1));
  }

  return { labels, values };
}

// Network traffic chart (host.json만 사용)
function initializeNetworkChart(hostData) {
  const labels   = hostData.map(h => h.hostName);
  const received = hostData.map(h =>
    parseInt(h.network.eth0_0.bytesReceived) + parseInt(h.network.wlan0_1.bytesReceived)
  );
  const sent = hostData.map(h =>
    parseInt(h.network.eth0_0.bytesSent) + parseInt(h.network.wlan0_1.bytesSent)
  );

  new Chart(document.getElementById('networkChart').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Bytes Received',
          data: received,
          fill: true,
          tension: 0.3,
          borderColor: '#CC9900',                // 진한 노란색
          backgroundColor: 'rgba(204,153,0,0.3)' // 반투명 채우기
        },
        {
          label: 'Bytes Sent',
          data: sent,
          fill: true,
          tension: 0.3,
          borderColor: '#996600',                // 아주 진한 노란색
          backgroundColor: 'rgba(153,102,0,0.3)' // 반투명 채우기
        }
      ]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => (v / 1e6).toFixed(1) + ' MB'
          }
        }
      }
    }
  });
}

// Network speed chart (host.json만 사용)
function initializeNetworkSpeedChart(hostData) {
  const labels    = hostData.map(h => h.hostName);
  const ethSpeed  = hostData.map(h => parseInt(h.network.eth0_0.speedbps) / 1e6);
  const wlanSpeed = hostData.map(h => parseInt(h.network.wlan0_1.speedbps) / 1e6);

  new Chart(document.getElementById('networkSpeedChart').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'eth0 (Mbps)',
          data: ethSpeed,
          fill: false,
          tension: 0.3
        },
        {
          label: 'wlan0 (Mbps)',
          data: wlanSpeed,
          fill: false,
          tension: 0.3
        }
      ]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Mbps' }
        }
      }
    }
  });
}
