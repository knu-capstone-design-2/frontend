FROM eclipse-temurin:21-jre
WORKDIR /app
COPY build/libs/data-collector-0.0.1-SNAPSHOT.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]

#FROM openjdk:17-jdk-slim

#WORKDIR /app

# 1. 자바 소스 코드 복사
#COPY ./src/main/java/kr/cs/interdata/datacollector/ContainerResourceMonitor.java .

# 2. Gson 라이브러리 복사
#COPY ./libs/gson-2.10.1.jar ./libs/

# 3. 컴파일 및 실행
#RUN javac -cp ".:libs/gson-2.10.1.jar" ContainerResourceMonitor.java
#CMD ["java", "-cp", ".:libs/gson-2.10.1.jar", "kr.cs.interdata.datacollector.ContainerResourceMonitor"]
#FROM gradle:8.2.1-jdk17 AS builder

# 캐시 디렉토리 공유 제거! 아래 라인 제거했음
# VOLUME ["/home/gradle/.gradle"]

#COPY --chown=gradle:gradle . /home/gradle/project
#WORKDIR /home/gradle/project

# 권한 문제 회피 위해 --no-daemon 추가
#RUN gradle build -x test --no-daemon