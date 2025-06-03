package kr.cs.interdata.api_backend.repository;

import kr.cs.interdata.api_backend.entity.TargetType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TargetTypeRepository extends JpaRepository<TargetType, Integer> {
    Optional<TargetType> findByType(String type);
}
