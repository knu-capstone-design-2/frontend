package kr.cs.interdata.api_backend.repository;

import kr.cs.interdata.api_backend.entity.MonitoredMachineInventory;
import kr.cs.interdata.api_backend.entity.TargetType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MonitoredMachineInventoryRepository extends JpaRepository<MonitoredMachineInventory, String> {

    // 타입이 type인 모든 데이터의 수를 가져옴.
    @Query("SELECT COUNT(m) FROM MonitoredMachineInventory m WHERE m.type.type = :typeName")
    int countByType(@Param("typeName") String typeName);

    // 모든 데이터의 수를 가져옴.
    @Query("SELECT COUNT(m) FROM MonitoredMachineInventory m")
    int countAll();

    // type에 따라 displayId 중 최대값을 가져옴
    @Query("SELECT m.id " +
            "FROM MonitoredMachineInventory m " +
            "WHERE m.type = :type AND m.id IS NOT NULL " +
            "ORDER BY m.id DESC")
    List<String> findTopIdByType(@Param("type") TargetType type, Pageable pageable);

    // machine id를 통해 id를 반환하는 메서드
    Optional<MonitoredMachineInventory> findByMachineId(String machineId);

}
