let containerChart, netChart;
let containersData = [];
let containerCpuGaugeChart, containerMemGaugeChart, containerDiskGaugeChart;

document.addEventListener('DOMContentLoaded', () => {
  fetch('./container.json')
    .then(res => res.json())
    .then(data => {
      containersData = data;
      renderUnderResourced(containersData);

      const topContainer = containersData.reduce(
        (prev, curr) =>
          curr.cpuUsagePercent > prev.cpuUsagePercent ? curr : prev,
        containersData[0]
      );


      renderContainerUsage(topContainer);
      initContainerTimeSeries(containersData);
      setupUsageToggles('container');
      renderContainerSelector(containersData, topContainer);
      drawNetwork(topContainer);
    })
    .catch(err => console.error('Data load error:', err));
});

// 1) Recent Under-resourced
function renderUnderResourced(data) {
  const combined = data.map(c => ({
    name:   c.containerName ?? c.hostName,
    cpu:    c.cpuUsagePercent,
    memory: (c.memoryUsedBytes / c.memoryTotalBytes) * 100,
    disk:   ((c.diskReadBytes + c.diskWriteBytes) /
             (c.diskReadBytes + c.diskWriteBytes + 1)) * 100
  }))
  .sort((a, b) => b.cpu - a.cpu);

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

// 2) Container Current Usage 
function renderContainerUsage(container) {
  const cpuPct  = Math.round(container.cpuUsagePercent);
  const memPct  = Math.round((container.memoryUsedBytes / container.memoryTotalBytes) * 100);
  const diskPct = Math.round(((container.diskReadBytes + container.diskWriteBytes) /
                              (container.diskReadBytes + container.diskWriteBytes + 1)) * 100);

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
          const cy = top + height / 2;
          ctx.save();
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'middle';
          ctx.font      = 'bold 16px sans-serif';
          ctx.fillStyle = '#000';
          ctx.fillText(value + '%', cx, cy - 10);
          ctx.font      = '12px sans-serif';
          ctx.fillText(label, cx, cy + 14);
          ctx.restore();
        }
      }]
    });
  };

  if (containerCpuGaugeChart)  containerCpuGaugeChart.destroy();
  if (containerMemGaugeChart)  containerMemGaugeChart.destroy();
  if (containerDiskGaugeChart) containerDiskGaugeChart.destroy();

  containerCpuGaugeChart  = makeGauge('containerCpuGauge',  cpuPct,  'CPU');
  containerMemGaugeChart  = makeGauge('containerMemGauge',  memPct,  'Memory');
  containerDiskGaugeChart = makeGauge('containerDiskGauge', diskPct, 'Disk');
}

// 3) Container Usage Time-series
function initContainerTimeSeries(data) {
  const ctx = document.getElementById('containerChart').getContext('2d');
  const now = Date.now();
  const timestamps = Array.from({ length: 30 }, (_, i) =>
    new Date(now - (29 - i) * 60000)
  );

  const cpuData  = Array(30).fill(data[0].cpuUsagePercent);
  const memData  = Array(30).fill((data[0].memoryUsedBytes / data[0].memoryTotalBytes) * 100);
  const diskData = Array(30).fill((data[0].diskReadBytes / data[0].diskTotalBytes) * 100);

  containerChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: timestamps,
      datasets: [
        { label: 'CPU',    data: cpuData,  fill: false },
        { label: 'Memory', data: memData,  fill: false },
        { label: 'Disk',   data: diskData, fill: false }
      ]
    },
    options: {
      elements: { point: { radius: 2, hoverRadius: 4 } },
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
  });
}

// 4) 토글 버튼
function setupUsageToggles(target) {
  document.querySelectorAll(`.toggle-buttons.${target} .toggle`)
    .forEach(btn => btn.addEventListener('click', () => {
      document.querySelectorAll(`.toggle-buttons.${target} .toggle`)
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const type = btn.dataset.type;
      containerChart.data.datasets.forEach(ds => {
        ds.hidden = ds.label.toLowerCase() !== type;
      });
      containerChart.update();
    }));
}

// 5) Container 선택 버튼 생성
function renderContainerSelector(containers, initial) {
  const sel = document.getElementById('networkContainerSelector');
  sel.innerHTML = '';
  containers.forEach(c => {
    const btn = document.createElement('button');
    btn.textContent = c.containerName ?? c.hostName;
    btn.addEventListener('click', () => {
      sel.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderContainerUsage(c);
      drawNetwork(c);
    });
    if (c === initial) btn.classList.add('active');
    sel.appendChild(btn);
  });
}

// 6) Network Traffic 차트
function drawNetwork(item) {
  const ifaces = Object.keys(item.network);
  const now = Date.now();
  const timestamps = Array.from({ length: 30 }, (_, i) =>
    new Date(now - (29 - i) * 60000)
  );

  const datasets = [];
  ifaces.forEach(iface => {
    const { bytesReceived, bytesSent } = item.network[iface];
    const recv = parseInt(bytesReceived, 10);
    const sent = parseInt(bytesSent,     10);
    datasets.push(
      { label: `${iface} Recv`, data: Array(30).fill(recv), fill: false },
      { label: `${iface} Sent`, data: Array(30).fill(sent), fill: false }
    );
  });

  const ctx = document.getElementById('networkChart').getContext('2d');
  if (netChart) netChart.destroy();
  netChart = new Chart(ctx, {
    type: 'line',
    data: { labels: timestamps, datasets },
    options: {
      elements: {
        point: { radius: 2, hoverRadius: 4 }
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
        y: { beginAtZero: true, ticks: { callback: v => v + ' B' } }
      }
    }
  });
}
