package org.example;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
// 这是三合一
// 说明是主配置类，
// 检查pom.xml是否有数据库连接和tomcat，
// 最后自动扫描当前包和子包的文件

@MapperScan("org.example.mapper")
//  where is mapper interface
public class Main {
    public static void main(String[] args) {
        // launch
        SpringApplication.run(Main.class, args);
    }
}