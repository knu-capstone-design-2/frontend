/**package kr.cs.interdata.datacollector;

import com.google.gson.Gson;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.Producer;
import org.apache.kafka.common.serialization.StringSerializer;

import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

public class ResourceMonitorDaemon {
    public static void main(String[] args) throws Exception {
        // Kafka Producer 설정
        Properties props = new Properties();
        props.put("bootstrap.servers", "host.docker.internal:19092");

        //props.put("bootstrap.servers", "host.docker.internal:9092");
        //props.put("bootstrap.servers", "host.docker.internal:9092");
        //props.put("bootstrap.servers", "localhost:9092"); // Kafka 브로커 주소 (필요시 수정)
        props.put("acks", "all");
        props.put("retries", 0);
        props.put("batch.size", 16384);
        props.put("linger.ms", 1);
        props.put("buffer.memory", 33554432);
        props.put("key.serializer", StringSerializer.class.getName());
        props.put("value.serializer", StringSerializer.class.getName());

        String topic = "localhost"; // 원하는 토픽명으로 변경 가능

        try (Producer<String, String> producer = new KafkaProducer<>(props)) {
            LocalHostResourceMonitor monitor = new LocalHostResourceMonitor();

            long prevDiskReadBytes = 0;
            long prevDiskWriteBytes = 0;
            Map<String, Long> prevNetRecv = new HashMap<>();
            Map<String, Long> prevNetSent = new HashMap<>();

            ObjectMapper prettyMapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

            while (true) {
                String jsonStr = monitor.getResourcesAsJson();
                Map<String, Object> resourceMap = new Gson().fromJson(jsonStr, Map.class);

                // 1. 디스크 변화량 계산
                long currDiskReadBytes = ((Number) resourceMap.get("diskReadBytes")).longValue();
                long currDiskWriteBytes = ((Number) resourceMap.get("diskWriteBytes")).longValue();
                long deltaDiskRead = currDiskReadBytes - prevDiskReadBytes;
                long deltaDiskWrite = currDiskWriteBytes - prevDiskWriteBytes;

                // 2. 네트워크 변화량 계산
                Map<String, Object> netInfo = (Map<String, Object>) resourceMap.get("network");
                Map<String, Map<String, Object>> netDelta = new HashMap<>();
                for (String iface : netInfo.keySet()) {
                    Map<String, Object> ifaceInfo = (Map<String, Object>) netInfo.get(iface);
                    long currRecv = ((Number) ifaceInfo.get("bytesReceived")).longValue();
                    long currSent = ((Number) ifaceInfo.get("bytesSent")).longValue();
                    long prevRecv = prevNetRecv.getOrDefault(iface, currRecv);
                    long prevSent = prevNetSent.getOrDefault(iface, currSent);

                    long deltaRecv = currRecv - prevRecv;
                    long deltaSent = currSent - prevSent;

                    // 네트워크 속도(Bps, 초당 바이트)
                    long rxBps = deltaRecv / 5;
                    long txBps = deltaSent / 5;

                    Map<String, Object> ifaceDelta = new HashMap<>();
                    ifaceDelta.put("rxBytesDelta", deltaRecv);
                    ifaceDelta.put("txBytesDelta", deltaSent);
                    ifaceDelta.put("rxBps", rxBps);
                    ifaceDelta.put("txBps", txBps);
                    netDelta.put(iface, ifaceDelta);

                    prevNetRecv.put(iface, currRecv);
                    prevNetSent.put(iface, currSent);
                }

                // 3. 필요 없는 누적값(디스크/네트워크) 삭제
                resourceMap.remove("diskReadBytes");
                resourceMap.remove("diskWriteBytes");
                resourceMap.remove("network");

                // 4. 변화량만 추가
                resourceMap.put("diskReadBytesDelta", deltaDiskRead);
                resourceMap.put("diskWriteBytesDelta", deltaDiskWrite);
                resourceMap.put("networkDelta", netDelta);

                // 5. 예쁘게 출력
                String prettyJson = prettyMapper.writeValueAsString(resourceMap);
                System.out.println(prettyJson);

                // 6. Kafka로 전송
                ProducerRecord<String, String> record = new ProducerRecord<>(topic, prettyJson);
                producer.send(record, (metadata, exception) -> {
                    if (exception != null) {
                        System.err.println("Kafka 전송 실패: " + exception.getMessage());
                    } else {
                        System.out.println("Kafka 전송 성공: " + metadata.topic() + " offset=" + metadata.offset());
                    }
                });

                // 7. 이전값 갱신
                prevDiskReadBytes = currDiskReadBytes;
                prevDiskWriteBytes = currDiskWriteBytes;

                try {
                    Thread.sleep(5000);
                } catch (InterruptedException ie) {
                    System.out.println("Interrupted, but monitoring continues.");
                }
            }
        }
    }
}
**/

/**package kr.cs.interdata.datacollector;

import com.google.gson.Gson;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.Producer;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.serialization.StringSerializer;

import java.util.Properties;
import java.util.concurrent.Future;

public class ResourceMonitorDaemon {
    public static void main(String[] args) throws Exception {
        LocalHostResourceMonitor monitor = new LocalHostResourceMonitor();

        // 이전 디스크 I/O 값 저장
        long prevDiskReadBytes = 0;
        long prevDiskWriteBytes = 0;

        // 이전 네트워크 인터페이스별 값 저장
        Map<String, Long> prevNetRecv = new HashMap<>();
        Map<String, Long> prevNetSent = new HashMap<>();

        ObjectMapper prettyMapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

        while (true) {
            String jsonStr = monitor.getResourcesAsJson();
            Map<String, Object> resourceMap = new Gson().fromJson(jsonStr, Map.class);

            // 1. 디스크 변화량 계산
            long currDiskReadBytes = ((Number) resourceMap.get("diskReadBytes")).longValue();
            long currDiskWriteBytes = ((Number) resourceMap.get("diskWriteBytes")).longValue();
            long deltaDiskRead = currDiskReadBytes - prevDiskReadBytes;
            long deltaDiskWrite = currDiskWriteBytes - prevDiskWriteBytes;

            // 2. 네트워크 변화량 계산
            Map<String, Object> netInfo = (Map<String, Object>) resourceMap.get("network");
            Map<String, Map<String, Object>> netDelta = new HashMap<>();
            for (String iface : netInfo.keySet()) {
                Map<String, Object> ifaceInfo = (Map<String, Object>) netInfo.get(iface);
                long currRecv = ((Number) ifaceInfo.get("bytesReceived")).longValue();
                long currSent = ((Number) ifaceInfo.get("bytesSent")).longValue();
                long prevRecv = prevNetRecv.getOrDefault(iface, currRecv);
                long prevSent = prevNetSent.getOrDefault(iface, currSent);

                long deltaRecv = currRecv - prevRecv;
                long deltaSent = currSent - prevSent;

                // 네트워크 속도(Bps, 초당 바이트)
                long rxBps = deltaRecv / 5;
                long txBps = deltaSent / 5;

                Map<String, Object> ifaceDelta = new HashMap<>();
                ifaceDelta.put("rxBytesDelta", deltaRecv);
                ifaceDelta.put("txBytesDelta", deltaSent);
                ifaceDelta.put("rxBps", rxBps); // 초당 받은 바이트
                ifaceDelta.put("txBps", txBps); // 초당 보낸 바이트
                netDelta.put(iface, ifaceDelta);

                prevNetRecv.put(iface, currRecv);
                prevNetSent.put(iface, currSent);
            }

            // 3. 필요 없는 누적값(디스크/네트워크) 삭제
            resourceMap.remove("diskReadBytes");
            resourceMap.remove("diskWriteBytes");
            resourceMap.remove("network");

            // 4. 변화량만 추가
            resourceMap.put("diskReadBytesDelta", deltaDiskRead);
            resourceMap.put("diskWriteBytesDelta", deltaDiskWrite);
            resourceMap.put("networkDelta", netDelta);

            // 5. 예쁘게 출력
            String prettyJson = prettyMapper.writeValueAsString(resourceMap);
            //System.out.println("=== 로컬 호스트 리소스 수집 결과 ===");
            System.out.println(prettyJson);

            // 6. 이전값 갱신
            prevDiskReadBytes = currDiskReadBytes;
            prevDiskWriteBytes = currDiskWriteBytes;

            try {
                Thread.sleep(5000);
            } catch (InterruptedException ie) {
                // 인터럽트가 발생하면 로그만 남기고 계속 반복
                System.out.println("Interrupted, but monitoring continues.");
            }
        }
    }
}
 **/