import { useEffect, useRef, useState } from "react";
import styles from "./Dashboard.module.css";
import Chart from "chart.js/auto";
import moment from "moment";
import "chartjs-adapter-moment";
import hostData from "../../assets/mock/host.json";
import containerData from "../../assets/mock/container.json";
import Sidebar from "../Sidebar/Sidebar";

function Dashboard() {
  const [thresholds, setThresholds] = useState({
    cpuPercent: "",
    memoryPercent: "",
    diskPercent: "",
    networkTraffic: "",
  });
  const [selectedDate, setSelectedDate] = useState("");
  const [summaryRows, setSummaryRows] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState(null);
  const [selectedHostId, setSelectedHostId] = useState(hostData[0].hostId);
  const [selectedContainerId, setSelectedContainerId] = useState(containerData[0].containerId);
  const selectedHostData = hostData.find((host) => host.hostId === selectedHostId);
  const selectedContainerData = containerData.find((c) => c.containerId === selectedContainerId);

  const hostChartRef = useRef(null);
  const containerChartRef = useRef(null);
  const hostChartInstance = useRef(null);
  const containerChartInstance = useRef(null);
  const hostNetworkChartRef = useRef(null);
  const hostNetworkChartInstance = useRef(null);
  const containerNetworkChartRef = useRef(null);
  const containerNetworkChartInstance = useRef(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      initChart("host", hostChartRef.current, [selectedHostData]);
      initChart("container", containerChartRef.current, [selectedContainerData]);
      initNetworkChart(hostNetworkChartRef, hostNetworkChartInstance, selectedHostData.network);
      initNetworkChart(containerNetworkChartRef, containerNetworkChartInstance, selectedContainerData.network);
      setupThresholdSSE();
      setupWebSocket();
    }, 300);
    return () => clearTimeout(timeout);
  }, [selectedHostId, selectedContainerId]);

  const setupThresholdSSE = () => {
    const eventSource = new EventSource("/api/metrics/threshold-alert");
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setThresholds((prev) => ({
          ...prev,
          [data.metricName + "Percent"]: parseFloat(data.value),
        }));
      } catch (e) {
        console.error("❌ Threshold SSE 파싱 오류:", e);
      }
    };
    eventSource.onerror = (e) => {
      console.error("❌ Threshold SSE 에러:", e);
      eventSource.close();
    };
  };

  const setupWebSocket = () => {
    const socket = new WebSocket(import.meta.env.VITE_WS_URL);
    socket.onopen = () => console.log("✅ WebSocket 연결됨");

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const source = data.containerId ? "container" : data.hostId ? "host" : "unknown";

        if ((data.type === "localhost" || data.type === "container") && data.networkDelta) {
          const targetRef = data.type === "localhost" ? hostNetworkChartRef : containerNetworkChartRef;
          const targetInstance = data.type === "localhost" ? hostNetworkChartInstance : containerNetworkChartInstance;
          if (!targetInstance.current) {
            initNetworkChart(targetRef, targetInstance, data.networkDelta);
          }
          drawNetworkLive(data.networkDelta, targetInstance);
        }

        if (data.type === "container") updateContainerChart(data);
        if (data.type === "localhost") updateHostChart(data);
        if (data.hostId || data.containerId) updateSummary(data);
        setLiveMetrics(data);
      } catch (e) {
        console.error("웹소켓 데이터 파싱 오류:", e);
      }
    };

    socket.onerror = (e) => console.error("❌ WebSocket 에러", e);
    socket.onclose = () => console.warn("🔌 WebSocket 연결 종료됨");
  };

  const updateSummary = (data) => {
  const name = data.hostId || data.containerId || "Unknown";
  const cpu = data.cpuUsagePercent || 0;
  const memory = data.memoryUsedBytes && data.memoryTotalBytes
    ? (data.memoryUsedBytes / data.memoryTotalBytes) * 100
    : 0;
  const disk = data.diskUsedBytes && data.diskTotalBytes
    ? (data.diskUsedBytes / data.diskTotalBytes) * 100
    : 0;

  setSummaryRows((prev) =>
    [...prev.filter((r) => r.name !== name), { name, cpu, memory, disk }]
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 3)
  );
};

  const updateHostChart = (data) => {
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
    chart.data.labels.push(now);
    chart.data.labels.shift();
    chart.data.datasets[0].data.push(cpu);
    chart.data.datasets[0].data.shift();
    chart.data.datasets[1].data.push(memoryPercent);
    chart.data.datasets[1].data.shift();
    chart.data.datasets[2].data.push(diskPercent);
    chart.data.datasets[2].data.shift();
    chart.update("none");
  };

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
    chart.update("none");
  };

  const drawNetworkLive = (networkDelta, chartInstance) => {
    const chart = chartInstance.current;
    if (!chart) return;
    const now = new Date();
    chart.data.labels.push(now);
    chart.data.labels.shift();
    chart.data.datasets.forEach((dataset) => {
      const [iface, direction] = dataset.label.split(" ");
      const delta = networkDelta[iface];
      const bps = delta ? (direction === "Recv" ? delta.rxBps ?? 0 : delta.txBps ?? 0) : 0;
      const kbps = parseFloat((bps / 1000).toFixed(2));
      dataset.data.push(kbps);
      dataset.data.shift();
    });
    chart.update("none");
  };

  const COLORS = ["#ff6384", "#36a2eb", "#cc65fe", "#ffce56", "#4bc0c0", "#9966ff", "#c9cbcf", "#ff9f40"];

  const initChart = (type, canvas, data) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const usage = data[0] ?? {
      cpuUsagePercent: 0,
      memoryUsedBytes: 0,
      memoryTotalBytes: 1,
      diskUsedBytes: 0,
      diskTotalBytes: 1,
    };
    const chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 60000)),
        datasets: [
          {
            label: "CPU",
            yAxisID: "y",
            data: Array(30).fill(usage.cpuUsagePercent),
            borderColor: "#ff6384",
          },
          {
            label: "Memory",
            yAxisID: "y1",
            data: Array(30).fill((usage.memoryUsedBytes / usage.memoryTotalBytes) * 100),
            borderColor: "#36a2eb",
          },
          {
            label: "Disk",
            yAxisID: "y1",
            data: Array(30).fill((usage.diskUsedBytes / usage.diskTotalBytes) * 100),
            borderColor: "#ffce56",
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              boxWidth: 8,
              boxHeight: 8,
              padding: 12,
            },
          },
        },
        scales: {
          x: { type: "time", time: { unit: "second" } },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Percentage (%)" },
          },
          y1: {
            beginAtZero: true,
            position: "right",
            grid: { drawOnChartArea: false },
            title: { display: true, text: "Bytes (b)" },
          },
        },
      },
    });
    if (type === "host") {
      if (hostChartInstance.current) hostChartInstance.current.destroy();
      hostChartInstance.current = chart;
    }
    if (type === "container") {
      if (containerChartInstance.current) containerChartInstance.current.destroy();
      containerChartInstance.current = chart;
    }
  };

  const initNetworkChart = (ref, instanceRef, networkDelta) => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    instanceRef.current?.destroy();
    const timestamps = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 1000));
    const interfaces = Object.keys(networkDelta);
    const datasets = interfaces.flatMap((iface, idx) => [
      {
        label: `${iface} Recv`,
        data: Array(30).fill(0),
        borderColor: COLORS[(idx * 2) % COLORS.length],
      },
      {
        label: `${iface} Sent`,
        data: Array(30).fill(0),
        borderColor: COLORS[(idx * 2 + 1) % COLORS.length],
      },
    ]);
    instanceRef.current = new Chart(ctx, {
      type: "line",
      data: { labels: timestamps, datasets },
      options: {
        responsive: true,
        animation: false,
        plugins: {
          legend: {
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              boxWidth: 6,
              boxHeight: 6,
              padding: 10,
            },
          },
        },
        scales: {
          x: {
            type: "time",
            time: { unit: "second" },
          },
          y: {
            beginAtZero: true,
            suggestedMax: 10,
            title: {
              display: true,
              text: "Kilobits per Second (Kbps)",
            },
          },
        },
      },
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
          <p>
            ⚙️ 현재 임계치 - CPU: {thresholds.cpuPercent}%, Mem: {thresholds.memoryPercent}%, Disk: {thresholds.diskPercent}%
          </p>
        </div>
        {liveMetrics && (
          <div className={styles.liveMetricsBanner}>
            📈 실시간 메트릭 - CPU: {liveMetrics.cpuUsagePercent?.toFixed(1)}%, Mem: {((liveMetrics.memoryUsedBytes / liveMetrics.memoryTotalBytes) * 100).toFixed(1)}%, Disk: {((liveMetrics.diskUsedBytes / liveMetrics.diskTotalBytes) * 100).toFixed(1)}%
          </div>
        )}
        <div className={styles.dashboard}>
          <div className={styles.row}>
            <div className={styles.card}>
              <div className={styles.header}>
                <h2>Host Machine Usage</h2>
                <select value={selectedHostId} onChange={(e) => setSelectedHostId(e.target.value)}>
                  {hostData.map((host) => (
                    <option key={host.hostId} value={host.hostId}>{host.hostName}</option>
                  ))}
                </select>
              </div>
              <canvas ref={hostChartRef} />
            </div>
            <div className={styles.card}>
              <div className={styles.header}>
                <h2>Container Usage</h2>
                <select value={selectedContainerId} onChange={(e) => setSelectedContainerId(e.target.value)}>
                  {containerData.map((c) => (
                    <option key={c.containerId} value={c.containerId}>{c.containerName}</option>
                  ))}
                </select>
              </div>
              <canvas ref={containerChartRef} />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.card}>
              <div className={styles.header}>
                <h2>Host Network Traffic</h2>
                <select value={selectedHostId} onChange={(e) => setSelectedHostId(e.target.value)}>
                  {hostData.map((host) => (
                    <option key={host.hostId} value={host.hostId}>{host.hostName}</option>
                  ))}
                </select>
              </div>
              <canvas ref={hostNetworkChartRef} />
            </div>
            <div className={styles.card}>
              <div className={styles.header}>
                <h2>Container Network Traffic</h2>
                <select value={selectedContainerId} onChange={(e) => setSelectedContainerId(e.target.value)}>
                  {containerData.map((c) => (
                    <option key={c.containerId} value={c.containerId}>{c.containerName}</option>
                  ))}
                </select>
              </div>
              <canvas ref={containerNetworkChartRef} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
