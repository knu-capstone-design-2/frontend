// 수정된 Dashboard.jsx – Container 차트 정상 반영 포함
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
    console.log('🧪 containerData:', containerData);
    renderSummary();
    initChart('host', hostChartRef.current, hostData);
    initChart('container', containerChartRef.current, containerData);
    renderHostSelector();
    drawNetwork(hostData[0]);
    setupThresholdSSE();
    setupWebSocket();
  }, []);

  const setupThresholdSSE = () => {
    const eventSource = new EventSource('/api/metrics/threshold-alert');
    eventSource.onopen = () => console.log('✅ Threshold SSE 연결됨');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📥 Threshold 실시간 데이터:', data);
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
      console.log('📨 받은 메시지:', event.data);
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'metrics') {
          console.log('📡 실시간 메트릭 도착:', data);
          setLiveMetrics(data);
          updateCharts(data);
        } else if (data.type === 'container') {
          updateContainerChart(data);
        }
      } catch (e) {
        console.error('웹소켓 데이터 파싱 오류:', e);
      }
    };
    socket.onerror = (e) => console.error('❌ WebSocket 에러', e);
    socket.onclose = () => console.warn('🔌 WebSocket 연결 종료됨');
  };

  const updateContainerChart = (data) => {
    console.log('📊 컨테이너 차트 업데이트 시작:', data);
    const now = new Date();
    if (containerChartInstance.current) {
      const chart = containerChartInstance.current;
      chart.data.labels.push(now);
      chart.data.labels.shift();
      chart.data.datasets[0].data.push(data.cpuUsagePercent);
      chart.data.datasets[0].data.shift();
      const memoryPercent = data.memoryUsedBytes ? (data.memoryUsedBytes / (2 * 1024 * 1024 * 1024)) * 100 : 0;
      chart.data.datasets[1].data.push(memoryPercent);
      chart.data.datasets[1].data.shift();
      const diskDelta = (data.diskReadBytesDelta ?? 0) + (data.diskWriteBytesDelta ?? 0);
      chart.data.datasets[2].data.push(diskDelta / 100);
      chart.data.datasets[2].data.shift();
      chart.update();
    }
  };

  const renderSummary = () => {
    const combined = [...hostData, ...containerData].map(item => ({
      name: item.hostName || item.containerName,
      cpu: item.cpuUsagePercent,
      memory: (item.memoryUsedBytes / item.memoryTotalBytes) * 100,
      disk: item.diskTotalBytes
        ? (item.diskUsedBytes / item.diskTotalBytes) * 100
        : ((item.diskReadBytes + item.diskWriteBytes) / (item.diskReadBytes + item.diskWriteBytes + 1)) * 100
    }));
    const top = combined.sort((a, b) => b.cpu - a.cpu).slice(0, 3);
    setSummaryRows(top);
  };

  const initChart = (type, canvas, data) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (type === 'host' && hostChartInstance.current) hostChartInstance.current.destroy();
    if (type === 'container' && containerChartInstance.current) containerChartInstance.current.destroy();

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

    if (type === 'host') hostChartInstance.current = chart;
    if (type === 'container') containerChartInstance.current = chart;
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
    if (!networkChartRef.current) return;
    const ctx = networkChartRef.current.getContext('2d');
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
          <p>⚙️ 현재 임계치 - CPU: {thresholds.cpuPercent}%, Mem: {thresholds.memoryPercent}%, Disk: {thresholds.diskPercent}%, Net: {thresholds.networkTraffic}</p>
        </div>

        {liveMetrics && (
          <div className={styles.liveMetricsBanner}>
            📈 실시간 메트릭 → CPU: {liveMetrics.cpu}%, Mem: {liveMetrics.memory}%, Disk: {liveMetrics.disk}%
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
                  <button className={styles.searchButton} onClick={renderSummary}>🔍</button>
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
