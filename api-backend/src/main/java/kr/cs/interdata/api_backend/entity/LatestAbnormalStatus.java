package kr.cs.interdata.api_backend.entity;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 *  - table name : LatestAbnormalStatus
 *  - 용도 : 현재 이상 상태(미해결)만 기록(resolved = false) / ui 전달용 entity를 저장
 *  - 사용 시나리오 :
 *   1. 처음 db에 저장하면 영구 저장되며 이 entity는 "재사용"된다.
 *   2. 처음 이상값이 생겨 db에 저장된 entity는 resolved = false로 저장되며,
 *      이는 이상값이 해결될 시 resolved = true로 update된다.
 *      또한, 다시 이 머신의 메트릭에 이상이 생긴다면
 *      기존 db에 저장된 entity의 resolved를 false로 update하면서 재사용된다.
 *
 *  - PK : number   // table에 들어온 순서대로의 누적 번호값
 */
@Entity
@Table(name = "LatestAbnormalStatus")
@Getter
@Setter
public class LatestAbnormalStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer number;     // unique id

    private String targetId;   // anomaly machine's unique id
    private String metricName; // anomaly metric's name
    private String value;       // outlier
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss", shape = JsonFormat.Shape.STRING)
    private LocalDateTime detectedAt;  // anomaly detection time
    private boolean resolved;   // 이상값이 해결되지 않았다면 false, 이상값이 해결되었다면 true로 update한다.

}
