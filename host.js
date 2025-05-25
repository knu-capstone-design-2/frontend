let hostChart, netChart;
let hostsData = [];
let containerData = [];
let cpuGaugeChart, memGaugeChart, diskGaugeChart;

document.addEventListener('DOMContentLoaded', () => {
  Promise.all([
    fetch('./host.json').then(res => res.json()),
    fetch('./container.json').then(res => res.json())
  ])
    .then(([hosts, containers]) => {
      hostsData      = hosts;
      containerData  = containers;
      renderUnderResourced(hostsData);

      const topHost = hostsData.reduce(
        (prev, curr) => curr.cpuUsagePercent > prev.cpuUsagePercent ? curr : prev,
        hostsData[0]
      );

      renderHostStats(topHost);
      initHostTimeSeries(hostsData);
      setupHostToggles();
      renderHostSelector(hostsData);
      drawNetwork(topHost);
    })
    .catch(err => console.error('Data load error:', err));
});

// 1) Under-Resourced Host 테이블 
function renderUnderResourced(hostData) {
  const combined = hostData.map(h => ({
    name:   h.hostName,
    cpu:    h.cpuUsagePercent,
    memory: (h.memoryUsedBytes / h.memoryTotalBytes) * 100,
    disk:   (h.diskUsedBytes   / h.diskTotalBytes)   * 100
  })).sort((a, b) => b.cpu - a.cpu);

  const tbody = document.querySelector('#underResourcedTable tbody');
  tbody.innerHTML = '';
  combined.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.cpu.toFixed(0)}%</td>
      <td>${item.memory.toFixed(0)}%</td>
      <td>${item.disk.toFixed(0)}%</td>
    `;
    tbody.appendChild(tr);
  });
}

// 2) Host Stats 
function renderHostStats(host) {
  const cpuPct  = Math.round(host.cpuUsagePercent);
  const memPct  = Math.round((host.memoryUsedBytes / host.memoryTotalBytes) * 100);
  const diskPct = Math.round((host.diskUsedBytes   / host.diskTotalBytes)   * 100);
  const makeGauge = (canvasId, value, label) => {
    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [label, ''],
        datasets: [{
          data: [value, 100 - value],
          backgroundColor: ['#4caf50', '#eeeeee'],
          borderWidth: 0
        }]
      },
      options: {
        cutout: '80%',
        plugins: {
          tooltip: { enabled: false },
          legend:  { display: false }
        }
      },
      plugins: [{
        id: 'centerText',
        beforeDraw(chart) {
          const { ctx, chartArea: { left, top, width, height } } = chart;
          const cx = left + width / 2;
          const cy = top  + height / 2;
          ctx.save();
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'middle';
          ctx.font      = 'bold 18px sans-serif';
          ctx.fillStyle = '#000';
          ctx.fillText(value + '%', cx, cy - 14);
          ctx.font      = '12px sans-serif';
          ctx.fillText(label, cx, cy + 16);

          ctx.restore();
        }
      }]
    });
  };

  if (cpuGaugeChart)  cpuGaugeChart.destroy();
  if (memGaugeChart)  memGaugeChart.destroy();
  if (diskGaugeChart) diskGaugeChart.destroy();

  cpuGaugeChart  = makeGauge('cpuGauge',  cpuPct,  'CPU');
  memGaugeChart  = makeGauge('memGauge',  memPct,  'Memory');
  diskGaugeChart = makeGauge('diskGauge', diskPct, 'Disk');
}


// 3) Host Usage Time-series
function initHostTimeSeries(data) {
  const ctx = document.getElementById('hostChart').getContext('2d');
  const timestamps = Array.from({ length: 30 }, (_, i) =>
    new Date(Date.now() - (29 - i) * 60000)
  );
  const cpu = Array(30).fill(data[0].cpuUsagePercent);
  const mem = Array(30).fill((data[0].memoryUsedBytes / data[0].memoryTotalBytes) * 100);
  const disk = Array(30).fill((data[0].diskUsedBytes / data[0].diskTotalBytes) * 100);
  const cfg = {
    type: 'line',
    data: {
      labels: timestamps,
      datasets: [
        { label: 'CPU',    data: cpu,    fill: false, pointStyle: 'circle' },
        { label: 'Memory', data: mem,    fill: false, pointStyle: 'circle' },
        { label: 'Disk',   data: disk,   fill: false, pointStyle: 'circle' }
      ]
    },
    options: {
      elements: {
        point: {
          radius: 2,
          hoverRadius: 4
        }
      },
      plugins: {
        legend: {
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,         
            boxHeight: 8,
            padding: 16  
          }
        }
      },
      scales: {
        x: { type: 'time', time: { unit: 'minute' } },
        y: { beginAtZero: true }
      }
    }
  };

  hostChart = new Chart(ctx, cfg);
}

// 4) Toggle buttons for host
function setupHostToggles() {
  document.querySelectorAll('.toggle-buttons.host .toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-buttons.host .toggle')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.dataset.type;
      hostChart.data.datasets.forEach(ds => ds.hidden = ds.label.toLowerCase() !== type);
      hostChart.update();
    });
  });
}

// 5) Network host selection UI
function renderHostSelector(hosts) {
  const sel = document.getElementById('networkHostSelector');
  hosts.forEach((h, i) => {
    const btn = document.createElement('button');
    btn.textContent = h.hostName;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.host-selector button')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      drawNetwork(h);
    });
    if (i === 0) btn.classList.add('active');
    sel.appendChild(btn);
  });
}

// 6) Network Traffic chart
function drawNetwork(host) {
  const ifaces = Object.keys(host.network);
  const timestamps = Array.from({ length: 30 }, (_, i) =>
    new Date(Date.now() - (29 - i) * 60000)
  );
  const datasets = [];

  ifaces.forEach(iface => {
    const { bytesReceived, bytesSent } = host.network[iface];
    datasets.push(
      { label: `${iface} Recv`, data: Array(30).fill(parseInt(bytesReceived, 10)), fill: false, pointStyle: 'circle' },
      { label: `${iface} Sent`, data: Array(30).fill(parseInt(bytesSent, 10)),     fill: false, pointStyle: 'circle' }
    );
  });

  const ctx = document.getElementById('networkChart').getContext('2d');
  if (netChart) netChart.destroy();
  netChart = new Chart(ctx, {
    type: 'line',
    data: { labels: timestamps, datasets },
    options: {
      elements: {
        point: {
          radius: 3,
          hoverRadius: 5
        }
      },
      plugins: {
        legend: {
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,          
            boxHeight: 8,
            padding: 16  
          }
        }
      },
      scales: {
        x: { type: 'time', time: { unit: 'minute' } },
        y: {
          beginAtZero: true,
          ticks: { callback: v => v + ' B' }
        }
      }
    }
  });
}
