package kr.cs.interdata.api_backend.repository;

import kr.cs.interdata.api_backend.entity.MetricsByType;
import kr.cs.interdata.api_backend.entity.TargetType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MetricsByTypeRepository extends JpaRepository<MetricsByType, Integer> {

    // "host" 타입의 Metrics만 조회
    List<MetricsByType> findByType_Type(String typeName);

    // 메트릭 이름으로 조회
    List<MetricsByType> findByMetricName(String metricName);

    boolean existsByTypeAndMetricName(TargetType type, String metricName);
}
