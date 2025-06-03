/**package kr.cs.interdata.datacollector;

import oshi.SystemInfo;
import oshi.hardware.NetworkIF;
import oshi.hardware.HardwareAbstractionLayer;
import oshi.hardware.NetworkIF.IfOperStatus;
import com.google.gson.Gson;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class LocalHostNetworkMonitor {
    private final List<NetworkIF> networkIFS;

    public LocalHostNetworkMonitor() {
        SystemInfo si = new SystemInfo();
        HardwareAbstractionLayer hal = si.getHardware();
        this.networkIFS = hal.getNetworkIFs();
    }

    public Map<String, Object> getNetworkInfoJson() {
        Map<String, Object> result = new LinkedHashMap<>();
        int idx = 0;

        for (NetworkIF net : networkIFS) {
            net.updateAttributes();

            // 활성화된 인터페이스만 포함
            if (net.getIfOperStatus() == IfOperStatus.UP) {
                Map<String, Object> netInfo = new LinkedHashMap<>();
                netInfo.put("speedBps", net.getSpeed()); // bps
                netInfo.put("bytesReceived", net.getBytesRecv()); // byte
                netInfo.put("bytesSent", net.getBytesSent()); // byte
                result.put(net.getName() + "_" + idx, netInfo);
                idx++;
            }
        }

        return result;
    }
}

/**package kr.cs.interdata.datacollector;
//oshi 라이브러리 : 시스템 정보를 가져옴
//https://github.com/oshi/oshi/blob/master/oshi-core/src/main/java/oshi/hardware/NetworkIF.java
import oshi.SystemInfo;//시스템 전체 정보를 다룰 수 있음
import oshi.hardware.NetworkIF;//네트워크 인터페이스 담음
import java.util.ArrayList;
import java.util.List;
import com.google.gson.Gson;
import java.util.HashMap;
import java.util.Map;
public class LocalHostNetworkMonitor {
    private final List<NetworkIF> networkIFS;//네트워크 인터페이스 리스트
    //final은 변수에 한번만 값 할당 가능하게 하는거임,리스트 내부는 수정할 수 있음.
    public LocalHostNetworkMonitor() {//생성자
        //oshi 라이브러리에서 시스템의 모든 네트워크 인터페이스 목록을 한번만 가져와서 저장함.
        SystemInfo si= new SystemInfo();
        this.networkIFS=si.getHardware().getNetworkIFs();
    }
    public List<String> getNetworkInterfaceNames(){
        //네트워크 이름 반환
        List<String> names = new ArrayList<>();
        for (NetworkIF net : networkIFS) {
            names.add(net.getName());
        }
        return names;
    }

    public List<Double> getNetworkSpeeds(){
        //네트워크 전송 속도 반환
        List<Double> speeds = new ArrayList<>();
        for (NetworkIF net : networkIFS) {
            speeds.add((double)net.getSpeed()/1000000);//Mbps로
        }
        return speeds;
    }
    public List<Double> getBytesReceived(){
        //받은 데이터량 반환
        List<Double> recvBytes=new ArrayList<>();
        for (NetworkIF net : networkIFS) {
            recvBytes.add((double)net.getBytesRecv()/1024/1024);//MB로
            //GB로 할려고 하니 값이 너무 작아짐
        }
        return recvBytes;
    }
    public List<Double> getBytesSent(){
        //보낸 데이터량 반환
        List<Double> sentBytes=new ArrayList<>();
        for (NetworkIF net : networkIFS) {
            sentBytes.add((double)net.getBytesSent()/1024/1024);//MB
        }
        return sentBytes;
    }

    public Map<String, Object> getNetworkInfoJson() {
        Map<String, Object> result = new HashMap<>();
        SystemInfo si = new SystemInfo();
        List<NetworkIF> networkIFS = si.getHardware().getNetworkIFs();

        int idx = 0;
        for (NetworkIF net : networkIFS) {
            Map<String, Object> netInfo = new HashMap<>();
            netInfo.put("speed", String.valueOf(net.getSpeed()));
            netInfo.put("bytesReceived", String.valueOf(net.getBytesRecv()));
            netInfo.put("bytesSent", String.valueOf(net.getBytesSent()));
            result.put(net.getName() + "_" + idx, netInfo); // 이름 중복 방지
            idx++;
        }

        return result;
    }
}
**/