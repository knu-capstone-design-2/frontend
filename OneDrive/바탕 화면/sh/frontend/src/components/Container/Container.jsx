// ✅ Container.jsx – Host.jsx 구조 통일 + 사이드바 선택/스크롤 문제 수정본
import { useEffect, useRef, useState } from 'react';
import styles from './Container.module.css';
import Chart from 'chart.js/auto';
import moment from 'moment';
import 'chartjs-adapter-moment';
import containerData from '../../assets/mock/container.json';
import Sidebar from '../Sidebar/Sidebar';

function Container() {
  const [selectedContainer, setSelectedContainer] = useState(containerData[0]);
  const [activeMetric, setActiveMetric] = useState('cpu');
  const [showSettings, setShowSettings] = useState(false);
  const [thresholds, setThresholds] = useState({
    cpuPercent: 80,
    memoryPercent: 70,
    diskPercent: 75,
    networkTraffic: 1000
  });

  const usageChartRef = useRef(null);
  const usageChartInstance = useRef(null);
  const networkChartRef = useRef(null);
  const networkChartInstance = useRef(null);
  const cpuGaugeRef = useRef(null);
  const memGaugeRef = useRef(null);
  const diskGaugeRef = useRef(null);

  useEffect(() => {
    renderUsageChart();
    renderNetworkChart();
    renderGauges();
  }, [selectedContainer]);

  useEffect(() => {
    updateMetric();
  }, [activeMetric]);

  const updateMetric = () => {
    if (!usageChartInstance.current) return;
    usageChartInstance.current.data.datasets.forEach(ds => {
      ds.hidden = ds.label.toLowerCase() !== activeMetric;
    });
    usageChartInstance.current.update();
  };

  const renderUnderResourced = () => {
    return [...containerData]
      .map(c => ({
        name: c.containerName,
        cpu: c.cpuUsagePercent,
        memory: (c.memoryUsedBytes / c.memoryTotalBytes) * 100,
        disk: ((c.diskReadBytes + c.diskWriteBytes) / (c.diskReadBytes + c.diskWriteBytes + 1)) * 100
      }))
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 3);
  };

  const renderGauges = () => {
    const cpu = Math.round(selectedContainer.cpuUsagePercent);
    const memory = Math.round((selectedContainer.memoryUsedBytes / selectedContainer.memoryTotalBytes) * 100);
    const disk = Math.round(((selectedContainer.diskReadBytes + selectedContainer.diskWriteBytes) / (selectedContainer.diskReadBytes + selectedContainer.diskWriteBytes + 1)) * 100);
    drawGauge('containerCpuGauge', cpu, 'CPU', cpuGaugeRef);
    drawGauge('containerMemGauge', memory, 'Memory', memGaugeRef);
    drawGauge('containerDiskGauge', disk, 'Disk', diskGaugeRef);
  };

  const drawGauge = (id, value, label, ref) => {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    ref.current?.destroy();
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
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
          legend: { display: false }
        }
      },
      plugins: [{
        id: 'centerText',
        beforeDraw(chart) {
          const { ctx, chartArea: { left, top, width, height } } = chart;
          const cx = left + width / 2;
          const cy = top + height / 2;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillStyle = '#000';
          ctx.fillText(value + '%', cx, cy - 10);
          ctx.font = '12px sans-serif';
          ctx.fillText(label, cx, cy + 14);
          ctx.restore();
        }
      }]
    });
    ref.current = chart;
  };

  const renderUsageChart = () => {
    if (!usageChartRef.current) return;
    const ctx = usageChartRef.current.getContext('2d');
    usageChartInstance.current?.destroy();

    const timestamps = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 60000));
    const data = {
      cpu: Array(30).fill(selectedContainer.cpuUsagePercent),
      memory: Array(30).fill((selectedContainer.memoryUsedBytes / selectedContainer.memoryTotalBytes) * 100),
      disk: Array(30).fill(((selectedContainer.diskReadBytes + selectedContainer.diskWriteBytes) / (selectedContainer.diskReadBytes + selectedContainer.diskWriteBytes + 1)) * 100)
    };

    usageChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: timestamps,
        datasets: [
          { label: 'CPU', data: data.cpu, borderColor: '#ff6384', hidden: activeMetric !== 'cpu' },
          { label: 'Memory', data: data.memory, borderColor: '#36a2eb', hidden: activeMetric !== 'memory' },
          { label: 'Disk', data: data.disk, borderColor: '#ffce56', hidden: activeMetric !== 'disk' }
        ]
      },
      options: {
        plugins: {
          legend: {
            display: true,
            labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 12 }
          }
        },
        elements: { point: { radius: 2, hoverRadius: 4 } },
        scales: {
          x: { type: 'time', time: { unit: 'minute' } },
          y: { beginAtZero: true }
        }
      }
    });
  };

  const renderNetworkChart = () => {
    if (!networkChartRef.current) return;
    const ctx = networkChartRef.current.getContext('2d');
    networkChartInstance.current?.destroy();

    const timestamps = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 60000));
    const datasets = Object.entries(selectedContainer.network).flatMap(([iface, stats]) => [
      { label: `${iface} Recv`, data: Array(30).fill(Number(stats.bytesReceived)), borderColor: '#4bc0c0', fill: false },
      { label: `${iface} Sent`, data: Array(30).fill(Number(stats.bytesSent)), borderColor: '#9966ff', fill: false }
    ]);

    networkChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: { labels: timestamps, datasets },
      options: {
        plugins: { legend: { labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 12 } } },
        scales: {
          x: { type: 'time', time: { unit: 'minute' } },
          y: { beginAtZero: true, ticks: { callback: v => v + ' B' } }
        }
      }
    });
  };

  return (
    <div className={styles.wrapper}>
      <Sidebar onSettingsClick={() => setShowSettings(true)} />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1>Container Monitoring</h1>
          <select onChange={e => setSelectedContainer(containerData.find(c => c.containerName === e.target.value))}>
            {containerData.map((c, i) => (
              <option key={i} value={c.containerName}>{c.containerName}</option>
            ))}
          </select>
        </div>

        <div className={styles.dashboard}>
          <div className={`${styles.row} ${styles['summary-section']}`}>
            <div className={`${styles['summary-card']} ${styles['under-resourced']}`}>
              <h3>Under Resourced Containers</h3>
              <div className={styles['table-wrapper']}>
                <table>
                  <thead><tr><th>Name</th><th>CPU%</th><th>Memory%</th><th>Disk%</th></tr></thead>
                  <tbody>
                    {renderUnderResourced().map((r, i) => (
                      <tr key={i}>
                        <td>{r.name}</td>
                        <td>{r.cpu.toFixed(0)}%</td>
                        <td>{r.memory.toFixed(0)}%</td>
                        <td>{r.disk.toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`${styles['summary-card']} ${styles['container-usage']}`}>
              <h3>Container Status</h3>
              <div className={styles['gauge-container']}>
                <canvas id="containerCpuGauge" width="80" height="80"></canvas>
                <canvas id="containerMemGauge" width="80" height="80"></canvas>
                <canvas id="containerDiskGauge" width="80" height="80"></canvas>
              </div>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.card}>
              <div className={styles.header}>
                <h2>Container Usage</h2>
                <div className={styles['toggle-buttons']}>
                  {['cpu', 'memory', 'disk'].map(type => (
                    <button
                      key={type}
                      className={`${styles.toggle} ${activeMetric === type ? 'active' : ''}`}
                      onClick={() => setActiveMetric(type)}
                    >
                      {type.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <canvas ref={usageChartRef}></canvas>
            </div>

            <div className={styles.card}>
              <div className={styles.header}><h2>Network Traffic</h2></div>
              <canvas ref={networkChartRef}></canvas>
            </div>
          </div>
        </div>

        {/* 설정 패널 */}
        <div className={`${styles.overlay} ${showSettings ? styles.active : ''}`} onClick={() => setShowSettings(false)}></div>
        <div className={`${styles.settingsPanel} ${showSettings ? styles.active : ''}`}>
          <h2>Threshold Settings</h2>
          <div className={styles.thresholdForm}>
            <label>CPU<input type="number" value={thresholds.cpuPercent} onChange={e => setThresholds({ ...thresholds, cpuPercent: e.target.value })} /></label>
            <label>Memory<input type="number" value={thresholds.memoryPercent} onChange={e => setThresholds({ ...thresholds, memoryPercent: e.target.value })} /></label>
            <label>Disk<input type="number" value={thresholds.diskPercent} onChange={e => setThresholds({ ...thresholds, diskPercent: e.target.value })} /></label>
            <label>Network<input type="number" value={thresholds.networkTraffic} onChange={e => setThresholds({ ...thresholds, networkTraffic: e.target.value })} /></label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => setShowSettings(false)}>닫기</button>
              <button className={styles.btnSave}>Save</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Container;
