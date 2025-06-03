package kr.cs.interdata.api_backend.repository;

import kr.cs.interdata.api_backend.entity.LatestAbnormalStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LatestAbnormalStatusRepository extends JpaRepository<LatestAbnormalStatus, Integer> {

    // 해당되는 Metric이름과 targetId를 가진 row를 찾음.
    Optional<LatestAbnormalStatus> findByTargetIdAndMetricName(String targetId, String metricName);

}
