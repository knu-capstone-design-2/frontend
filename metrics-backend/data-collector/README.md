### 1. 프로젝트 소개 (Project Title & Description)

> `data-collector`는 Java 기반 리소스 수집 시스템으로, 로컬 호스트(OSHI 기반) 및 컨테이너(cgroup 기반)의 CPU, 메모리, 디스크 I/O, 네트워크 사용량을 주기적으로 수집합니다. 이 데이터는 Kafka로 전송하고 모니터링 용도로 활용할 수 있습니다.

---

### 2. 주요 기능 (Key Features)

* 로컬 호스트 리소스 수집 (via OSHI)
* 컨테이너 리소스 수집 (via cgroup)
* 디스크/네트워크 변화량 계산
* 네트워크 전송/수신 속도(Bps) 계산
* Kafka 연동

---

### 3. 프로젝트 구조 (Project Structure) 

간략한 패키지 구조 예:

```
├── src/main/java/kr/cs/interdata/datacollector/
│   ├── LocalHostResourceMonitor.java
│   ├── LocalHostNetworkMonitor.java
│   ├── ContainerResourceMonitor.java
│   ├── DataCollectorApplication.java
│   └── ResourceMonitorDaemon.java
```

---

### 4. 실행 방법 (How to Run)

#### 로컬 호스트 리소스 수집 실행

로컬 시스템(호스트)의 리소스를 수집하려면 다음 명령어를 실행하세요:

```bash
# 로컬 호스트의 리소스 모니터링을 실행합니다.
./gradlew runLocalHostMonitor
```


#### 컨테이너 리소스 수집 실행

도커 환경에서 컨테이너 리소스를 수집하려면 아래 단계를 순서대로 따라 주세요:

```bash
# 1. 프로젝트를 빌드합니다.
./gradlew build

# 2. 도커 이미지를 생성합니다. (resource-monitor라는 이름으로 태그함)
docker build -t resource-monitor .

# 3. (선택) 이전에 실행 중이던 동일 이름의 컨테이너가 있다면 삭제합니다.
docker rm test-monitor

# 4. 컨테이너를 실행합니다.
# --privileged 옵션은 시스템 리소스 접근을 위해 필요합니다.
# 'test-monitor'라는 이름으로 컨테이너를 실행합니다.
docker run --privileged --name test-monitor resource-monitor
```

---

### 5. 환경 및 요구 사항 (Requirements)

* Java 17+
* Gradle
* Docker (for container mode)
* Linux (컨테이너 모니터링은 cgroup 의존)

---

### 6. 출력 예시 (Sample Output)

#### 로컬 호스트 리소스 수집 결과 예시
![image](https://github.com/user-attachments/assets/a387a2bc-61ce-463a-aa1b-52aa801f9a08)
```json
{
  "type": "localhost",
  "hostId": "a7d4293a-bea7-4599-934b-5e03df89ab6a",
  "cpuUsagePercent": 5.92,
  "memoryTotalBytes": 1.6963895296E10,
  "memoryUsedBytes": 1.551929344E10,
  "memoryFreeBytes": 1.444061856E9,
  "diskTotalBytes": 2.381804034304E11,
  "diskUsedBytes": 2.11586564096E11,
  "diskFreeBytes": 2.6597470208E10,
  "diskReadBytesDelta": 212992,
  "diskWriteBytesDelta": 605184,
  "networkDelta": {
    "ethernet_32773_4": {
      "rxBps": 0,
      "txBytesDelta": 0,
      "txBps": 0,
      "rxBytesDelta": 0
    },
    "wireless_0_7": {
      "rxBps": 622,
      "txBytesDelta": 1421,
      "txBps": 284,
      "rxBytesDelta": 3113
    },
    "ethernet_32774_5": {
      "rxBps": 0,
      "txBytesDelta": 0,
      "txBps": 0,
      "rxBytesDelta": 0
    }
  }
}
```

---

### 컨테이너 리소스 수집 결과 예시
![image](https://github.com/user-attachments/assets/6a089243-6f7f-4723-8283-a3a601130676)

```json
{
  "type": "container",
  "containerId": "fbf814b06b84",
  "cpuUsage": 39.88659,
  "memoryUsedBytes": 4.7386624E7,
  "diskReadBytesDelta": 0,
  "diskWriteBytesDelta": 0,
  "networkDelta": {
    "lo": {
      "rxBps": 0,
      "txBytesDelta": 0,
      "txBps": 0,
      "rxBytesDelta": 0
    },
    "eth0": {
      "rxBps": 0,
      "txBytesDelta": 0,
      "txBps": 0,
      "rxBytesDelta": 0
    }
  }
}
```

---

## 필드 설명

| 필드명                      | 설명                                        | 단위          |
| ------------------------ | ----------------------------------------- | ----------- |
| `type`                   | 리소스 수집 대상 유형 (`localhost` 또는 `container`) | 문자열         |
| `hostId` / `containerId` | 로컬 호스트의 고유 ID / 컨테이너 ID                   | UUID / 문자열  |
| `cpuUsagePercent`        | CPU 사용량 (로컬 호스트의 경우)                      | % (퍼센트)     |
| `cpuUsage`               | CPU 사용량 (컨테이너의 경우)                        | % (퍼센트)     |
| `memoryTotalBytes`       | 총 메모리 용량                                  | 바이트 (Bytes) |
| `memoryUsedBytes`        | 사용 중인 메모리 용량                              | 바이트 (Bytes) |
| `memoryFreeBytes`        | 사용 가능한 메모리 용량                             | 바이트 (Bytes) |
| `diskTotalBytes`         | 총 디스크 용량                                  | 바이트 (Bytes) |
| `diskUsedBytes`          | 사용 중인 디스크 용량                              | 바이트 (Bytes) |
| `diskFreeBytes`          | 사용 가능한 디스크 용량                             | 바이트 (Bytes) |
| `diskReadBytesDelta`     | 디스크 읽기 바이트 변화량                            | 바이트 (Bytes) |
| `diskWriteBytesDelta`    | 디스크 쓰기 바이트 변화량                            | 바이트 (Bytes) |
| `networkDelta`           | 각 네트워크 인터페이스별 전송/수신 정보                    | 객체          |
| `rxBytesDelta`           | 수신 바이트 변화량                                | 바이트 (Bytes) |
| `txBytesDelta`           | 송신 바이트 변화량                                | 바이트 (Bytes) |
| `rxBps`                  | 초당 수신 속도                                  | 바이트/초 (Bps) |
| `txBps`                  | 초당 송신 속도                                  | 바이트/초 (Bps) |

---

---



