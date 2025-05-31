// Dashboard.jsx
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

  const hostChartRef = useRef(null);
  const containerChartRef = useRef(null);
  const networkChartRef = useRef(null);

  const hostChartInstance = useRef(null);
  const containerChartInstance = useRef(null);
  const networkChartInstance = useRef(null);

  useEffect(() => {
    renderSummary();
    initChart('host', hostChartRef.current, hostData);
    initChart('container', containerChartRef.current, containerData);
    renderHostSelector();
    drawNetwork(hostData[0]);
    loadThresholds();
  }, []);

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

    const usage = data[0];
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

  const loadThresholds = async () => {
    try {
      const res = await fetch('/api/metrics/threshold-setting');
      const json = await res.json();
      setThresholds(json);
    } catch (e) {
      console.error(e);
    }
  };

  const saveThresholds = async () => {
    try {
      const res = await fetch('/api/metrics/threshold-setting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(thresholds)
      });
      if (!res.ok) throw new Error('Failed to save');
      alert('저장 성공 👍');
    } catch (e) {
      console.error(e);
      alert('저장 실패: ' + e.message);
    }
  };

  return (
    <div className={styles.dashboardWrapper}>
      <Sidebar onSettingsClick={() => setShowSettings(true)} />
      <main className={styles.mainContent}>
        <header className={styles.mainHeader}>
          <h1>Dashboard</h1>
          <input
            type="search"
            className={styles.search}
            placeholder="Search"
          />
        </header>

        <div className={styles.dashboard}>
          <div className={`${styles.row} ${styles.summarySection}`}>            
            <div className={styles.summaryCard}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>Under Resourced</h3>
                  <p className={styles.cardSubtitle}>Hosts & Containers approaching resource limits</p>
                </div>
                <div className={styles.filterControls}>
                  <input
                    type="date"
                    className={styles.dateInput} 
                    value={selectedDate} 
                    onChange={e => setSelectedDate(e.target.value)}
                  />
                  <button
                    className={styles.searchButton}
                    onClick={renderSummary}
                  >🔍</button>
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

          {/* Host & Container Charts */}
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

          {/* Network Traffic */}
          <div className={styles.row}>
            <div className={styles.card}>
              <div className={styles.header}><h2>Network Traffic</h2></div>
              <div id="networkHostSelector" className="host-selector" />
              <canvas ref={networkChartRef} />
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        <div className={`${styles.overlay} ${showSettings ? styles.active : ''}`} onClick={() => setShowSettings(false)} />
        <div className={`${styles.settingsPanel} ${showSettings ? styles.active : ''}`}>
          <h2>Threshold Settings</h2>
          <div className={styles.thresholdForm}>
            <label>CPU<input type="number" value={thresholds.cpuPercent} onChange={e => setThresholds({ ...thresholds, cpuPercent: e.target.value })} /></label>
            <label>Memory<input type="number" value={thresholds.memoryPercent} onChange={e => setThresholds({ ...thresholds, memoryPercent: e.target.value })} /></label>
            <label>Disk<input type="number" value={thresholds.diskPercent} onChange={e => setThresholds({ ...thresholds, diskPercent: e.target.value })} /></label>
            <label>Network<input type="number" value={thresholds.networkTraffic} onChange={e => setThresholds({ ...thresholds, networkTraffic: e.target.value })} /></label>
            <div className={styles.settingsButtons}>  
              <button onClick={() => setShowSettings(false)}>닫기</button>
              <button className={styles.btnSave} onClick={saveThresholds}>Save</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
