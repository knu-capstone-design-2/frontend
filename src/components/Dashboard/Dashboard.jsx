import { useEffect, useRef, useState } from 'react';
import styles from './Dashboard.module.css';
import Chart from 'chart.js/auto';
import moment from 'moment';
import 'chartjs-adapter-moment';
import hostData from '../../assets/mock/host.json';
import containerData from '../../assets/mock/container.json';
import Sidebar from '../Sidebar/Sidebar';

function Dashboard() {
  const [thresholds, setThresholds] = useState({ cpuPercent: '', memoryPercent: '', diskPercent: '', networkTraffic: '' });
  const [selectedDate, setSelectedDate] = useState('');
  const [summaryRows, setSummaryRows] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState(null);

  const hostChartRef = useRef(null);
  const containerChartRef = useRef(null);
  const networkChartRef = useRef(null);
  const hostChartInstance = useRef(null);
  const containerChartInstance = useRef(null);
  const networkChartInstance = useRef(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      initChart('host', hostChartRef.current, hostData);
      initChart('container', containerChartRef.current, containerData);
      renderHostSelector();
      drawNetwork(hostData[0]);
      setupThresholdSSE();
      setupWebSocket();
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  const setupThresholdSSE = () => {
    const eventSource = new EventSource('/api/metrics/threshold-alert');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setThresholds(prev => ({ ...prev, [data.metricName + 'Percent']: parseFloat(data.value) }));
      } catch (e) {
        console.error('❌ Threshold SSE 파싱 오류:', e);
      }
    };
    eventSource.onerror = (e) => {
      console.error('❌ Threshold SSE 에러:', e);
      eventSource.close();
    };
  };

  const setupWebSocket = () => {
    const socket = new WebSocket(import.meta.env.VITE_WS_URL);
    socket.onopen = () => console.log('✅ WebSocket 연결됨');
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'container') updateContainerChart(data);
        if (data.cpuUsagePercent !== undefined) updateHostChart(data);
        if (data.networkDelta) drawNetworkLive(data.networkDelta);
        if (data.hostId || data.containerId) updateSummary(data);
        setLiveMetrics(data);
      } catch (e) {
        console.error('웹소켓 데이터 파싱 오류:', e);
      }
    };
    socket.onerror = (e) => console.error('❌ WebSocket 에러', e);
    socket.onclose = () => console.warn('🔌 WebSocket 연결 종료됨');
  };

  function updateHostChart(data) {
    const chart = hostChartInstance.current;
    if (!chart) return;

    const now = new Date();
    const cpu = parseFloat(data.cpuUsagePercent);
    const memoryUsed = parseFloat(data.memoryUsedBytes);
    const memoryTotal = parseFloat(data.memoryTotalBytes);
    const memoryPercent = memoryTotal ? (memoryUsed / memoryTotal) * 100 : 0;

    const diskUsed = parseFloat(data.diskUsedBytes);
    const diskTotal = parseFloat(data.diskTotalBytes);
    const diskPercent = diskTotal ? (diskUsed / diskTotal) * 100 : 0;

    // ✅ 차트에 시간, cpu, memory, disk 반영
    chart.data.labels.push(now);
    chart.data.labels.shift();

    chart.data.datasets[0].data.push(cpu);
    chart.data.datasets[0].data.shift();

    chart.data.datasets[1].data.push(memoryPercent);
    chart.data.datasets[1].data.shift();

    chart.data.datasets[2].data.push(diskPercent);
    chart.data.datasets[2].data.shift();

    chart.update();
  }

  const updateContainerChart = (data) => {
    const chart = containerChartInstance.current;
    if (!chart) return;

    const now = new Date();
    const cpu = parseFloat(data.cpuUsagePercent);
    const memoryUsed = parseFloat(data.memoryUsedBytes);
    const memoryPercent = memoryUsed ? (memoryUsed / (2 * 1024 * 1024 * 1024)) * 100 : 0;
    const diskDelta = (parseFloat(data.diskReadBytesDelta ?? 0) + parseFloat(data.diskWriteBytesDelta ?? 0)) / 100;

    chart.data.labels.push(now);
    chart.data.labels.shift();
    chart.data.datasets[0].data.push(cpu);
    chart.data.datasets[0].data.shift();
    chart.data.datasets[1].data.push(memoryPercent);
    chart.data.datasets[1].data.shift();
    chart.data.datasets[2].data.push(diskDelta);
    chart.data.datasets[2].data.shift();
    chart.update();
  };

  const initChart = (type, canvas, data) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const usage = data[0] ?? { cpuUsagePercent: 0, memoryUsedBytes: 0, memoryTotalBytes: 1, diskUsedBytes: 0, diskTotalBytes: 1 };
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 60000)),
        datasets: [
          { label: 'CPU', data: Array(30).fill(usage.cpuUsagePercent), borderColor: '#ff6384' },
          { label: 'Memory', data: Array(30).fill((usage.memoryUsedBytes / usage.memoryTotalBytes) * 100), borderColor: '#36a2eb' },
          { label: 'Disk', data: Array(30).fill((usage.diskUsedBytes / usage.diskTotalBytes) * 100), borderColor: '#ffce56' }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 12 } } },
        scales: { x: { type: 'time', time: { unit: 'minute' } }, y: { beginAtZero: true } }
      }
    });
    if (type === 'host') {
      if (hostChartInstance.current) hostChartInstance.current.destroy();
      hostChartInstance.current = chart;
    }
    if (type === 'container') {
      if (containerChartInstance.current) containerChartInstance.current.destroy();
      containerChartInstance.current = chart;
    }
  };

  const updateSummary = (data) => {
    const name = data.hostId || data.containerId || 'Unknown';
    const cpu = data.cpuUsagePercent || 0;
    const memory = (data.memoryUsedBytes / data.memoryTotalBytes) * 100;
    const disk = data.diskTotalBytes ? (data.diskUsedBytes / data.diskTotalBytes) * 100 : 0;
    setSummaryRows(prev => [...prev.filter(r => r.name !== name), { name, cpu, memory, disk }].sort((a, b) => b.cpu - a.cpu).slice(0, 3));
  };

  const drawNetworkLive = (networkDelta) => {
    const chart = networkChartInstance.current;
    if (!chart) return;
    const now = new Date();
    chart.data.labels.push(now);
    chart.data.labels.shift();
    chart.data.datasets.forEach((dataset) => {
      const [iface, direction] = dataset.label.split(' ');
      const value = direction === 'Recv' ? (networkDelta[iface]?.rxBps ?? 0) : (networkDelta[iface]?.txBps ?? 0);
      dataset.data.push(value);
      dataset.data.shift();
    });
    chart.update();
  };

  const renderHostSelector = () => {
    const sel = document.getElementById('networkHostSelector');
    if (!sel) return;
    sel.innerHTML = '';
    hostData.forEach((h, i) => {
      const btn = document.createElement('button');
      btn.textContent = h.hostName;
      btn.onclick = () => {
        document.querySelectorAll('.host-selector button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        drawNetwork(h);
      };
      if (i === 0) btn.classList.add('active');
      sel.appendChild(btn);
    });
  };

  const drawNetwork = (host) => {
    const ctx = networkChartRef.current?.getContext('2d');
    if (!ctx) return;
    networkChartInstance.current?.destroy();
    const timestamps = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 60000));
    const datasets = Object.entries(host.network).flatMap(([iface, val]) => [
      { label: `${iface} Recv`, data: Array(30).fill(Number(val.bytesReceived)), borderColor: '#4bc0c0' },
      { label: `${iface} Sent`, data: Array(30).fill(Number(val.bytesSent)), borderColor: '#9966ff' }
    ]);
    networkChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: { labels: timestamps, datasets },
      options: {
        responsive: true,
        plugins: { legend: { labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 12 } } },
        scales: { x: { type: 'time', time: { unit: 'minute' } }, y: { beginAtZero: true } }
      }
    });
  };

  return (
    <div className={styles.dashboardWrapper}>
      <Sidebar onSettingsClick={() => setShowSettings(true)} />
      <main className={styles.mainContent}>
        <header className={styles.mainHeader}>
          <h1>Dashboard</h1>
          <input type="search" className={styles.search} placeholder="Search" />
        </header>
        <div className={styles.thresholdSummary}>
          <p>⚙️ 현재 임계치 - CPU: {thresholds.cpuPercent}%, Mem: {thresholds.memoryPercent}%, Disk: {thresholds.diskPercent}%</p>
        </div>
        {liveMetrics && (
          <div className={styles.liveMetricsBanner}>
            📈 실시간 메트릭 → CPU: {liveMetrics.cpuUsagePercent?.toFixed(1)}%, Mem: {(liveMetrics.memoryUsedBytes / liveMetrics.memoryTotalBytes * 100).toFixed(1)}%, Disk: {(liveMetrics.diskUsedBytes / liveMetrics.diskTotalBytes * 100).toFixed(1)}%
          </div>
        )}
        <div className={styles.dashboard}>
          <div className={`${styles.row} ${styles.summarySection}`}>
            <div className={styles.summaryCard}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>Under Resourced</h3>
                  <p className={styles.cardSubtitle}>Hosts & Containers approaching resource limits</p>
                </div>
                <div className={styles.filterControls}>
                  <input type="date" className={styles.dateInput} value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                  <button className={styles.searchButton}>🔍</button>
                </div>
              </div>
              <table>
                <thead>
                  <tr><th>Name</th><th>CPU</th><th>Memory</th><th>Disk</th></tr>
                </thead>
                <tbody>
                  {summaryRows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td>{r.cpu.toFixed(1)}%</td>
                      <td>{r.memory.toFixed(1)}%</td>
                      <td>{r.disk.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.card}>
              <div className={styles.header}><h2>Host Machine Usage</h2></div>
              <canvas ref={hostChartRef} />
            </div>
            <div className={styles.card}>
              <div className={styles.header}><h2>Container Usage</h2></div>
              <canvas ref={containerChartRef} />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.card}>
              <div className={styles.header}><h2>Network Traffic</h2></div>
              <div id="networkHostSelector" className="host-selector" />
              <canvas ref={networkChartRef} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
