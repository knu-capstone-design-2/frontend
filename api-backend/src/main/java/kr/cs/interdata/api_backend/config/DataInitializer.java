package kr.cs.interdata.api_backend.config;

import kr.cs.interdata.api_backend.entity.MetricsByType;
import kr.cs.interdata.api_backend.entity.TargetType;
import kr.cs.interdata.api_backend.repository.MetricsByTypeRepository;
import kr.cs.interdata.api_backend.repository.TargetTypeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    private final TargetTypeRepository targetTypeRepository;
    private final MetricsByTypeRepository metricsByTypeRepository;

    @Autowired
    public DataInitializer(TargetTypeRepository targetTypeRepository,
                           MetricsByTypeRepository metricsByTypeRepository) {
        this.targetTypeRepository = targetTypeRepository;
        this.metricsByTypeRepository = metricsByTypeRepository;
    }

    @Override
    public void run(String... args) {
        // 먼저 host, container 타입 존재 여부 확인
        TargetType hostType = targetTypeRepository.findByType("host")
                .orElseGet(() -> targetTypeRepository.save(TargetType.builder().type("host").build()));

        TargetType containerType = targetTypeRepository.findByType("container")
                .orElseGet(() -> targetTypeRepository.save(TargetType.builder().type("container").build()));

        // 이미 저장된 메트릭은 중복 방지
        insertMetricIfNotExists(hostType, "cpu", "%", 90.0);
        insertMetricIfNotExists(hostType, "memory", "bytes", 12700000000.0);
        insertMetricIfNotExists(hostType, "disk", "bytes", 30000000.0);
        insertMetricIfNotExists(hostType, "network", "bytes", 6000.0);

        insertMetricIfNotExists(containerType, "cpu", "%", 90.0);
        insertMetricIfNotExists(containerType, "memory", "bytes", 12700000000.0);
        insertMetricIfNotExists(containerType, "disk", "bytes", 30000000.0);
        insertMetricIfNotExists(containerType, "network", "bytes", 6000.0);
    }

    // 만약 type+name인 정보가 MetricsByType 테이블에 존재하지 않는다면 초기 정보를 넣는 메서드
    private void insertMetricIfNotExists(TargetType type, String name, String unit, Double threshold) {
        boolean exists = metricsByTypeRepository.existsByTypeAndMetricName(type, name);
        if (!exists) {
            MetricsByType metric = MetricsByType.builder()
                    .type(type)
                    .metricName(name)
                    .unit(unit)
                    .thresholdValue(threshold)
                    .build();
            metricsByTypeRepository.save(metric);
        }
    }

}
