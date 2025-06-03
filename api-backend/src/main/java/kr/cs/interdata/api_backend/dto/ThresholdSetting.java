package kr.cs.interdata.api_backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ThresholdSetting {

    private String cpuPercent;
    private String memoryPercent;
    private String diskPercent;
    private String networkTraffic;

}
