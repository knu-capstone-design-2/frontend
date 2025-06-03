package kr.cs.interdata.consumer.config;

import java.util.Map;
import java.util.HashMap;
import java.util.Collection;

//import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.KafkaListenerContainerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.listener.*;

@Configuration
public class ListenerContainerConfiguration {

    String bootstrap_server = "${KAFKA_TOPIC_HOST}";

    @Bean
    public KafkaListenerContainerFactory<ConcurrentMessageListenerContainer<String, String>> customContainerFactory() {
        Map<String, Object> props = new HashMap<>();

        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9094");     // Kafka 서버 주소 (브로커 리스트). 클러스터에 처음 연결할 때 사용하는 주소
        //props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "kafka:9094");           // kafka 서버 주소 -> container용
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);  // 메시지 키를 역직렬화할 클래스 (여기선 문자열로 처리)
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);    // 메시지 값을 역직렬화할 클래스 (여기서도 문자열)
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "data-stroage-group");    // 이 Consumer가 속한 Consumer Group ID (같은 Group ID면 하나만 처리함)
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");     // 이전에 커밋된 offset이 없을 경우 가장 처음(offset 0)부터 소비
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);  // Kafka가 자동으로 offset을 커밋하지 않도록 설정
        props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 200);     // 한 번 poll() 호출 시 가져올 최대 메시지 수

        DefaultKafkaConsumerFactory<Object, Object> cf = new DefaultKafkaConsumerFactory<>(props);
        ConcurrentKafkaListenerContainerFactory<String, String> factory = new ConcurrentKafkaListenerContainerFactory<>();

        factory.getContainerProperties().setConsumerRebalanceListener(new ConsumerAwareRebalanceListener() {

            /* @Override
            public void onPartitionsRevokedBeforeCommit(Consumer<?, ?> consumer, Collection<TopicPartition> partitions) {
		        // commit이 되기 전 리백런스가 발생했을 때
                System.out.println("리밸런싱 시작 - 반납된 파티션: " + partitions);
	        }

            @Override
            public void onPartitionsRevokedAfterCommit(Consumer<?, ?> consumer, Collection<TopicPartition> partitions) {
                // commit이 일어난 후에 리백런스가 발생했을 때
                System.out.println("리밸런싱 시작 - 반납된 파티션: " + partitions);
            } */

            @Override
            public void onPartitionsRevoked(Collection<TopicPartition> partitions) {
                System.out.println("리밸런싱 시작 - 반납된 파티션: " + partitions);
            }

            @Override
            public void onPartitionsAssigned(Collection<TopicPartition> partitions) {
                System.out.println("리밸런싱 완료 - 할당된 파티션: " + partitions);
            }

            @Override
            public void onPartitionsLost(Collection<TopicPartition> partitions) {

            }

        });

        factory.setBatchListener(true);
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL); // 수동 커밋
        factory.setConcurrency(2); // 병렬 컨슈머 수
        factory.setConsumerFactory(cf);

        return factory;
    }


}
