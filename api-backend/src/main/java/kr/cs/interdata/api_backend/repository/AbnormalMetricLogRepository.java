package kr.cs.interdata.api_backend.repository;

import kr.cs.interdata.api_backend.entity.AbnormalMetricLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface AbnormalMetricLogRepository extends JpaRepository<AbnormalMetricLog, Integer> {

    // 특정 날짜에 발생한 임계값 초과 기록 조회
    List<AbnormalMetricLog> findByTimestampBetween(LocalDateTime start, LocalDateTime end);
}
