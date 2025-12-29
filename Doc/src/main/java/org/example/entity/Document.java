package org.example.entity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import org.springframework.data.annotation.Id;

import java.time.LocalDateTime;

@Data
@TableName("document")
public class Document {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;

    private byte[] content;
    private Integer docType;
    private String fileKey;
    private Long ownerId;
    private Integer version;
    private LocalDateTime updateTime;
    private LocalDateTime createTime;
}

// 文件表项： id 标题 文件类型（0静态，1可实时编辑） 文件路径 创建者 版本 更新时间 创建时间