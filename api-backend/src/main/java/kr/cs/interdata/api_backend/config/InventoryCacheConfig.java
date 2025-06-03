package kr.cs.interdata.api_backend.config;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
public class InventoryCacheConfig {

    @Bean
    public Cache<String, String> inventoryCache() {
        return Caffeine.newBuilder()
                .expireAfterWrite(10, TimeUnit.MINUTES)  // 10분 캐싱
                .maximumSize(1000)                        // 최대 1000개 캐시
                .build();
    }
}
