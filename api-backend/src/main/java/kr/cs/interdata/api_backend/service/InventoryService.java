package kr.cs.interdata.api_backend.service;

import com.github.benmanes.caffeine.cache.Cache;
import kr.cs.interdata.api_backend.service.repository_service.MachineInventoryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class InventoryService {

    @Autowired
    private Cache<String, String> inventoryCache;
    @Autowired
    private MachineInventoryService machineInventoryService;

    private final Logger logger = LoggerFactory.getLogger(InventoryService.class);

    public String getOrGenerateUniqueId(String machineId, String type) {
        // 1. Cache에서 먼저 조회
        String targetId = inventoryCache.getIfPresent(machineId);

        // 2. 만약 targetId가 성공적으로 조회되었다면 이를 리턴.
        if (targetId != null) {
            logger.info("targetId(viewed) - {}", targetId); //TODO:지우기
            return targetId;
        }

        // 3. DB에서 조회 및 id 생성
        targetId = machineInventoryService.changeMachineIdToTargetId(type, machineId);
        logger.info("targetId(created) - {}", targetId); //TODO:지우기

        // 4. Cache에 추가
        inventoryCache.put(machineId, targetId);

        // 5. Cache에 추가 후, targetId를 리턴
        return targetId;
    }
}
