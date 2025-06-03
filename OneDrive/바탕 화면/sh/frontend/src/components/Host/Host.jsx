// ✅ Host.jsx – 사이드바 설정 연동 최종본 (Dashboard와 동일한 구조 적용)
import { useEffect, useRef, useState } from 'react';
import styles from './Host.module.css';
import Chart from 'chart.js/auto';
import moment from 'moment';
import 'chartjs-adapter-moment';
import hostData from '../../assets/mock/host.json';
import Sidebar from '../Sidebar/Sidebar';

function Host() {
  const [selectedHost, setSelectedHost] = useState(hostData[0]);
  const [activeMetric, setActiveMetric] = useState('cpu');
  const [showSettings, setShowSettings] = useState(false);
  const [thresholds, setThresholds] = useState({
    cpuPercent: 80,
    memoryPercent: 70,
    diskPercent: 75,
    networkTraffic: 1000
  });

  const hostChartRef = useRef(null);
  const hostChartInstance = useRef(null);
  const networkChartRef = useRef(null);
  const networkChartInstance = useRef(null);
  const cpuGaugeRef = useRef(null);
  const memGaugeRef = useRef(null);
  const diskGaugeRef = useRef(null);

  useEffect(() => {
    renderUsageChart();
    renderNetworkChart();
    renderGauges();
  }, [selectedHost]);

  useEffect(() => {
    updateMetric();
  }, [activeMetric]);

  const updateMetric = () => {
    if (!hostChartInstance.current) return;
    const datasets = hostChartInstance.current.data.datasets;
    datasets.forEach(ds => {
      ds.hidden = ds.label.toLowerCase() !== activeMetric;
    });
    hostChartInstance.current.update();
  };

  const renderUnderResourced = () => {
    return [...hostData]
      .map(h => ({
        name: h.hostName,
        cpu: h.cpuUsagePercent,
        memory: (h.memoryUsedBytes / h.memoryTotalBytes) * 100,
        disk: (h.diskUsedBytes / h.diskTotalBytes) * 100
      }))
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 3);
  };

  const renderGauges = () => {
    const cpu = Math.round(selectedHost.cpuUsagePercent);
    const memory = Math.round((selectedHost.memoryUsedBytes / selectedHost.memoryTotalBytes) * 100);
    const disk = Math.round((selectedHost.diskUsedBytes / selectedHost.diskTotalBytes) * 100);
    drawGauge('hostCpuGauge', cpu, 'CPU', cpuGaugeRef);
    drawGauge('hostMemGauge', memory, 'Memory', memGaugeRef);
    drawGauge('hostDiskGauge', disk, 'Disk', diskGaugeRef);
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
  if (!hostChartRef.current) return;
  const ctx = hostChartRef.current.getContext('2d');
  hostChartInstance.current?.destroy();

  const timestamps = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 60000));
  const data = {
    cpu: Array(30).fill(selectedHost.cpuUsagePercent),
    memory: Array(30).fill((selectedHost.memoryUsedBytes / selectedHost.memoryTotalBytes) * 100),
    disk: Array(30).fill((selectedHost.diskUsedBytes / selectedHost.diskTotalBytes) * 100)
  };

  hostChartInstance.current = new Chart(ctx, {
    type: 'line',
    data: {
      labels: timestamps,
      datasets: [
        { label: 'CPU', data: data.cpu, borderColor: '#ff6384' },
        { label: 'Memory', data: data.memory, borderColor: '#36a2eb' },
        { label: 'Disk', data: data.disk, borderColor: '#ffce56' }
      ]
    },
    options: {
      plugins: {
        legend: {
          display: true,
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            boxHeight: 8,
            padding: 12,
          },
          generateLabels(chart) {
            const datasets = chart.data.datasets;
            return datasets.map((ds, i) => ({
              text: ds.label,
              fillStyle: ds.borderColor,
              hidden: false,
              lineCap: 'butt',
              lineDash: [],
              lineDashOffset: 0,
              lineJoin: 'miter',
              strokeStyle: ds.borderColor,
              pointStyle: 'circle',
              datasetIndex: i
            }));
          }
        }
      },
      elements: {
        point: { radius: 2, hoverRadius: 4 }
      },
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
    const datasets = Object.entries(selectedHost.network).flatMap(([iface, stats]) => [
      { label: `${iface} Recv`, data: Array(30).fill(parseInt(stats.bytesReceived)), borderColor: '#4bc0c0', fill: false },
      { label: `${iface} Sent`, data: Array(30).fill(parseInt(stats.bytesSent)), borderColor: '#9966ff', fill: false }
    ]);

    networkChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: { labels: timestamps, datasets },
      options: {
        plugins: {
          legend: {
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
              boxHeight: 8,
              padding: 12
            }
          }
        },
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
          <h1>Host Monitoring</h1>
          <select onChange={e => setSelectedHost(hostData.find(h => h.hostName === e.target.value))}>
            {hostData.map((h, i) => (
              <option key={i} value={h.hostName}>{h.hostName}</option>
            ))}
          </select>
        </div>

        <div className={styles.dashboard}>
          <div className={`${styles.row} ${styles['summary-section']}`}>
            <div className={`${styles['summary-card']} ${styles['under-resourced']}`}>
              <h3>Under Resourced Hosts</h3>
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
              <h3>Host Status</h3>
              <div className={styles['gauge-container']}>
                <canvas id="hostCpuGauge" width="80" height="80"></canvas>
                <canvas id="hostMemGauge" width="80" height="80"></canvas>
                <canvas id="hostDiskGauge" width="80" height="80"></canvas>
              </div>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.card}>
              <div className={styles.header}>
                <h2>Host Usage</h2>
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
              <canvas ref={hostChartRef}></canvas>
            </div>

            <div className={styles.card}>
              <div className={styles.header}><h2>Network Traffic</h2></div>
              <canvas ref={networkChartRef}></canvas>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Host;
