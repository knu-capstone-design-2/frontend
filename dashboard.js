let hostChart, containerChart, netChart;
let hostsData = []; 
let alertSource = null;

const settingsBtn      = document.getElementById('settingsBtn');
const settingsPanel    = document.getElementById('settingsPanel');
const settingsOverlay  = document.getElementById('settingsOverlay');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');

document.getElementById('notificationsBtn')
  .addEventListener('click', () => {
    if (alertSource) return;  
    alertSource = new EventSource('/api/metrics/threshold-alert');
    alertSource.onmessage = e => {
      const data = JSON.parse(e.data);
      displayAlert(data);
    };
    alertSource.onerror = err => {
      console.error('SSE error:', err);
      alertSource.close();
      alertSource = null;
    };
  });

/**
 * 들어온 알림을 화면에 표시
 * @param {{targetId:string, metricName:string, value:string, timestamp:string}} data
 */
function displayAlert({ targetId, metricName, value, timestamp }) {
  const ul = document.getElementById('alertList');
  const li = document.createElement('li');
  li.textContent = 
    `${timestamp} — ${targetId} 의 ${metricName} 임계치 초과: ${value}`;
  ul.prepend(li); 
}


document.addEventListener('DOMContentLoaded', () => {
  fetch('./host.json')
    .then(res => res.json())
    .then(h => {
      hostsData = h;
      return fetch('./container.json');
    })
    .then(res => res.json())
    .then(cont => {
      renderSummary(hostsData, cont);
      initTimeSeries('host',      'hostChart',      hostsData);
      setupUsageToggles('host',   hostsData);
      initTimeSeries('container', 'containerChart', cont);
      setupUsageToggles('container', cont);
      renderHostSelector(hostsData);
      drawNetwork(hostsData[0]);
      setupThresholdFilter();             
    })
    .catch(err => console.error('Data load error:', err));
});

/**
 * 날짜별 임계치 초과 기록 필터링 기능 초기화
 */
function setupThresholdFilter() {
  const filterBtn = document.getElementById('thresholdFilterBtn');
  const dateInput = document.getElementById('thresholdDateInput');
  filterBtn.addEventListener('click', async () => {
    const date = dateInput.value;
    if (!date) {
      return alert('날짜를 선택해주세요.');
    }
    try {
      const res = await fetch('/api/metrics/threshold-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date })
      });
      if (!res.ok) throw new Error(res.statusText);
      const records = await res.json();
      renderThresholdHistory(records);
    } catch (e) {
      console.error('필터 조회 오류:', e);
      alert('조회 실패: ' + e.message);
    }
  });
}

/**
 * 필터 조회 결과를 테이블에 렌더링
 * @param {Array} records
 */
function renderThresholdHistory(records) {
  const tbody = document.querySelector('#underResourcedTable tbody');
  tbody.innerHTML = '';
  records.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${new Date(r.timestamp).toLocaleString()}</td>
      <td>${r.targetId}</td>
      <td>${r.metricName}</td>
      <td>${r.value}</td>
    `;
    tbody.appendChild(tr);
  });
}


document.addEventListener('DOMContentLoaded', () => {
  fetch('./host.json')
    .then(res => res.json())
    .then(h => {
      hostsData = h;
      return fetch('./container.json');
    })
    .then(res => res.json())
    .then(cont => {
      renderSummary(hostsData, cont);
      initTimeSeries('host',      'hostChart',      hostsData);
      setupUsageToggles('host',   hostsData);
      initTimeSeries('container', 'containerChart', cont);
      setupUsageToggles('container', cont);
      renderHostSelector(hostsData);
      drawNetwork(hostsData[0]);
    })
    .catch(err => console.error('Data load error:', err));
});

// 1) Summary 카드 생성
function renderSummary(hostData, containerData) {
  const hostSpeeds = hostData
    .map(h => {
      const totalBps = Object.values(h.network)
        .reduce((sum, iface) =>
          sum + parseFloat(iface.speedBps ?? iface.speedbps ?? 0)
        , 0);
      return { name: h.hostName, speed: totalBps / 1e6 };
    })
    .sort((a, b) => b.speed - a.speed);

  const thirdHostSpeed = hostSpeeds[2]?.speed ?? 0;
  const topHostWithTies = hostSpeeds.filter(hs => hs.speed >= thirdHostSpeed);
  const hostList = document.getElementById('topSpeedHosts');
  topHostWithTies.forEach(hs => {
    const li = document.createElement('li');
    li.textContent = `${hs.name} - ${hs.speed.toFixed(0)} Mbps`;
    hostList.appendChild(li);
  });

  const contSpeeds = containerData
    .map(c => {
      const totalBps = Object.values(c.network)
        .reduce((sum, iface) =>
          sum + parseFloat(iface.speedBps ?? iface.speedbps ?? 0)
        , 0);
      return {
        name: c.containerName ?? c.hostName,
        speed: totalBps / 1e6
      };
    })
    .sort((a, b) => b.speed - a.speed);

  const thirdContSpeed = contSpeeds[2]?.speed ?? 0;
  const topContWithTies = contSpeeds.filter(cs => cs.speed >= thirdContSpeed);
  const contList = document.getElementById('topSpeedContainers');
  topContWithTies.forEach(cs => {
    const li = document.createElement('li');
    li.textContent = `${cs.name} - ${cs.speed.toFixed(0)} Mbps`;
    contList.appendChild(li);
  });

  const combined = [];
  hostData.forEach(h => {
    combined.push({
      name:   h.hostName,
      cpu:    h.cpuUsagePercent,
      memory: (h.memoryUsedBytes / h.memoryTotalBytes) * 100,
      disk:   (h.diskUsedBytes   / h.diskTotalBytes)   * 100
    });
  });
  containerData.forEach(c => {
    combined.push({
      name:   c.containerName ?? c.hostName,
      cpu:    c.cpuUsagePercent,
      memory: (c.memoryUsedBytes / c.memoryTotalBytes) * 100,
      disk:   ((c.diskReadBytes + c.diskWriteBytes) /
               (c.diskReadBytes + c.diskWriteBytes + 1)) * 100
    });
  });

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

// 2) Usage Time-series 차트 초기화
function initTimeSeries(target, canvasId, data) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const timestamps = Array.from({ length: 30 }, (_, i) =>
    new Date(Date.now() - (29 - i) * 60000)
  );

  const cpu  = Array(30).fill(data[0].cpuUsagePercent);
  const mem  = Array(30).fill((data[0].memoryUsedBytes / data[0].memoryTotalBytes) * 100);
  const disk = Array(30).fill((data[0].diskUsedBytes   / data[0].diskTotalBytes)   * 100);
  const cfg = {
    type: 'line',
    data: {
      labels: timestamps,
      datasets: [
        { label: 'CPU',    data: cpu,  fill: false },
        { label: 'Memory', data: mem,  fill: false },
        { label: 'Disk',   data: disk, fill: false }
      ]
    },
    options: {
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
      elements: {
        point: {
          radius: 2,       
          hoverRadius: 4    
        }
      },
      scales: {
        x: { type: 'time', time: { unit: 'minute' } },
        y: { beginAtZero: true }
      }
    }
  };

  if (target === 'host') hostChart = new Chart(ctx, cfg);
  else containerChart = new Chart(ctx, cfg);
}

// 3) Usage 토글 버튼 
function setupUsageToggles(target, data) {
  document
    .querySelectorAll(`.toggle-buttons.${target} .toggle`)
    .forEach(btn => {
      btn.addEventListener('click', () => {
        document
          .querySelectorAll(`.toggle-buttons.${target} .toggle`)
          .forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const type  = btn.dataset.type;
        const chart = target === 'host' ? hostChart : containerChart;

        chart.data.datasets.forEach(ds => {
          ds.hidden = ds.label.toLowerCase() !== type;
        });
        chart.update();
      });
    });
}

// 4) 네트워크 호스트 선택 버튼 생성
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

// 5) Network Traffic 차트: 동적 인터페이스 처리
function drawNetwork(host) {
  const ifaces = Object.keys(host.network);
  const timestamps = Array.from({ length: 30 }, (_, i) =>
    new Date(Date.now() - (29 - i) * 60000)
  );

  const datasets = [];
  ifaces.forEach(iface => {
    const { bytesReceived, bytesSent } = host.network[iface];
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
    data: {
      labels: timestamps,
      datasets
    },
    options: {
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

// 페이지 로드 시 또는 패널 열릴 때: 저장된 임계값 불러와서 폼에 채우기
async function loadThresholds() {
  try {
    const res = await fetch('/api/metrics/threshold-setting', { method: 'GET' });
    if (!res.ok) throw new Error(res.statusText);
    const { cpuPercent, memoryPercent, diskPercent, networkTraffic } = await res.json();
    document.getElementById('cpuPercentInput').value      = cpuPercent;
    document.getElementById('memoryPercentInput').value   = memoryPercent;
    document.getElementById('diskPercentInput').value     = diskPercent;
    document.getElementById('networkTrafficInput').value  = networkTraffic;
  } catch (e) {
    console.error('Threshold load error:', e);
  }
}

// 버튼 클릭 시: 입력값 읽어서 서버에 저장하기
async function saveThresholds() {
  const payload = {
    cpuPercent:     document.getElementById('cpuPercentInput').value,
    memoryPercent:  document.getElementById('memoryPercentInput').value,
    diskPercent:    document.getElementById('diskPercentInput').value,
    networkTraffic: document.getElementById('networkTrafficInput').value
  };
  try {
    const res = await fetch('/api/metrics/threshold-setting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) alert('저장 성공 👍');
    else       alert('저장 실패: ' + (data.error || res.statusText));
  } catch (e) {
    console.error('Threshold save error:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const settingsBtn   = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const saveBtn       = document.getElementById('saveThresholdBtn');

  settingsBtn.addEventListener('click', () => {
    if (settingsPanel.classList.contains('hidden')) {
      settingsPanel.classList.remove('hidden');
      setTimeout(() => settingsPanel.classList.add('active'), 10);
      loadThresholds(); 
    } else {
      settingsPanel.classList.remove('active');
      settingsPanel.addEventListener('transitionend', () => {
        settingsPanel.classList.add('hidden');
      }, { once: true });
    }
  });

  saveBtn.addEventListener('click', saveThresholds);
});


function openSettings() {
  settingsOverlay.classList.remove('hidden');
  setTimeout(() => settingsOverlay.classList.add('active'), 10);

  settingsPanel.classList.remove('hidden');
  setTimeout(() => settingsPanel.classList.add('active'), 10);
  loadThresholds();
}

function closeSettings() {
  settingsOverlay.classList.remove('active');
  settingsPanel.classList.remove('active');

  const hide = elem => elem.addEventListener('transitionend', () => elem.classList.add('hidden'), { once: true });
  hide(settingsOverlay);
  hide(settingsPanel);
}

settingsBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', closeSettings);
saveBtn.addEventListener('click', saveThresholds);

