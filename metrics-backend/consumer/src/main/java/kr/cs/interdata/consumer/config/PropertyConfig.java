package kr.cs.interdata.consumer.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;
import org.springframework.context.annotation.PropertySources;
import java.lang.String;

@Configuration
@PropertySources({
        @PropertySource("classpath:properties/env.properties") //env.properties 파일 소스 등록
})
public class PropertyConfig {
}
