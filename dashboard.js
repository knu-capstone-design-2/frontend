let hostChart, containerChart;

document.addEventListener('DOMContentLoaded', () => {
  // Host Chart
  fetch('host.json')
    .then(res => res.json())
    .then(data => {
      initializeChart('hostChart', data, 'cpu', 'host');
      setupToggleButtons(data, 'host');
      initializeNetworkChart(data);  
    });

  // Container Chart
  fetch('container.json')
    .then(res => res.json())
    .then(data => {
      initializeChart('containerChart', data, 'cpu', 'container');
      setupToggleButtons(data, 'container');
    });
});

const topSpeedHosts = [
    { host: "host1", speed: "1200 Mbps" },
    { host: "host2", speed: "980 Mbps" },
    { host: "host3", speed: "850 Mbps" }
  ];
  
  const topUsageHosts = [
    { host: "host5", resource: "Memory", usage: "92%" },
    { host: "host3", resource: "Disk", usage: "87%" },
    { host: "host8", resource: "CPU", usage: "85%" }
  ];
  
  function renderSummaryBoxes() {
    const speedList = document.getElementById("topSpeedHosts");
    const usageList = document.getElementById("topUsageHosts");
  
    topSpeedHosts.forEach(item => {
      const li = document.createElement("li");
      li.textContent = `${item.host} - ${item.speed}`;
      speedList.appendChild(li);
    });
  
    topUsageHosts.forEach(item => {
      const li = document.createElement("li");
      li.textContent = `${item.host} (${item.resource}: ${item.usage})`;
      usageList.appendChild(li);
    });
  }
  
  document.addEventListener("DOMContentLoaded", renderSummaryBoxes);
  
// Bar 차트 초기화 함수 
function initializeChart(canvasId, data, type, target) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const chartData = prepareChartData(data, type, target);

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.labels,
      datasets: [{
        data: chartData.values,
        backgroundColor: '#6a5acd',
        borderRadius: 10,
        barThickness: 20,
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#eee' }
        },
        x: {
          grid: { color: '#eee' }
        }
      },
      plugins: {
        legend: { display: false },
      }
    }
  });

  if (target === 'host') hostChart = chart;
  else containerChart = chart;
}

// 데이터 타입별 토글 버튼 설정
function setupToggleButtons(data, target) {
  const buttons = document.querySelectorAll(`.toggle-buttons.${target} .toggle`);
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      buttons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      const type = button.getAttribute('data-type');
      const chart = target === 'host' ? hostChart : containerChart;
      updateChart(chart, data, type, target);
    });
  });
}

// 차트 업데이트 함수
function updateChart(chart, data, type, target) {
  const chartData = prepareChartData(data, type, target);
  chart.data.labels = chartData.labels;
  chart.data.datasets[0].data = chartData.values;
  chart.update();
}

// Host/Container 데이터 준비
function prepareChartData(data, type, target) {
  const labels = target === 'host'
    ? data.map((_, index) => `Host ${index + 1}`)
    : data.map(item => item.containerName);

  let values;
  switch (type) {
    case 'cpu':
      values = data.map(item => item.cpuUsagePercent);
      break;
    case 'memory':
      values = data.map(item =>
        ((item.memoryUsedBytes / item.memoryTotalBytes) * 100).toFixed(1)
      );
      break;
    case 'disk':
      values = data.map(item =>
        ((item.diskWriteBytes + item.diskReadBytes) / (item.diskWriteBytes + item.diskReadBytes + 1)) * 100
      );
      break;
    default:
      values = [];
  }

  return { labels, values };
}

// 네트워크 차트 초기화 (Bytes Sent/Received)
function initializeNetworkChart(hostData) {
  const labels = hostData.map(h => h.hostName || 'Unknown');

  const bytesReceivedData = hostData.map(h =>
    (parseInt(h.network?.eth0_0?.bytesReceived || 0)) +
    (parseInt(h.network?.wlan0_1?.bytesReceived || 0))
  );

  const bytesSentData = hostData.map(h =>
    (parseInt(h.network?.eth0_0?.bytesSent || 0)) +
    (parseInt(h.network?.wlan0_1?.bytesSent || 0))
  );

  const ctx = document.getElementById("networkChart").getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Bytes Received",
          data: bytesReceivedData,
          borderColor: "rgb(54, 162, 235)",
          fill: false,
          tension: 0.3
        },
        {
          label: "Bytes Sent",
          data: bytesSentData,
          borderColor: "rgb(255, 99, 132)",
          fill: false,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top" },
        title: {
          display: true,
          text: "Network Bytes Sent/Received per Host"
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return (value / 1_000_000).toFixed(1) + " MB";
            }
          }
        }
      }
    }
  });
}

function initializeNetworkChart(hostData) {
    const labels = hostData.map(h => h.hostName || 'Unknown');
  
    const bytesReceivedData = hostData.map(h =>
      (parseInt(h.network?.eth0_0?.bytesReceived || 0)) +
      (parseInt(h.network?.wlan0_1?.bytesReceived || 0))
    );
  
    const bytesSentData = hostData.map(h =>
      (parseInt(h.network?.eth0_0?.bytesSent || 0)) +
      (parseInt(h.network?.wlan0_1?.bytesSent || 0))
    );
  
    const ctx = document.getElementById("networkChart").getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Bytes Received",
            data: bytesReceivedData,
            borderColor: "rgb(54, 162, 235)",
            fill: false,
            tension: 0.3
          },
          {
            label: "Bytes Sent",
            data: bytesSentData,
            borderColor: "rgb(255, 99, 132)",
            fill: false,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "top" },
          title: {
            display: true,
            text: "Network Bytes Sent/Received per Host"
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return (value / 1_000_000).toFixed(1) + " MB";
              }
            }
          }
        }
      }
    });
  

    initializeNetworkSpeedChart(hostData);
  }
  
  function initializeNetworkSpeedChart(hostData) {
    const labels = hostData.map(h => h.hostName || 'Unknown');
  
    const ethSpeeds = hostData.map(h =>
      parseInt(h.network?.eth0_0?.speedbps || 0) / 1_000_000
    );
  
    const wlanSpeeds = hostData.map(h =>
      parseInt(h.network?.wlan0_1?.speedbps || 0) / 1_000_000
    );
  
    const ctx = document.getElementById("networkSpeedChart").getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "eth0 Speed (Mbps)",
            data: ethSpeeds,
            borderColor: "rgb(75, 192, 192)",
            fill: false,
            tension: 0.3
          },
          {
            label: "wlan0 Speed (Mbps)",
            data: wlanSpeeds,
            borderColor: "rgb(255, 205, 86)",
            fill: false,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "top" },
          title: {
            display: true,
            text: "Network Interface Speed (Mbps)"
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Speed (Mbps)"
            }
          }
        }
      }
    });
  }
  
