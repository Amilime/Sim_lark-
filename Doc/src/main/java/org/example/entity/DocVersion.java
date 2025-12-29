package org.example.entity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("doc_version")
public class DocVersion {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long docId;
    private Integer versionNum;
    private byte[] contentSnapshow;
    private Long editorId;
    private LocalDateTime createTime;
}

// 文件版本表项： 自身ID 文件ID 版本号 快照信息 编辑者ID 创建时间
