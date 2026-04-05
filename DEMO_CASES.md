# RAG系统端到端Demo案例

本文档包含3-5个端到端demo案例，展示系统的核心功能，覆盖本地PDF问答、混合web/feed/sitemap问答、no-hit/insufficient-context受控行为、trace detail排障等场景。

## 前提条件

1. 系统已部署并运行，API服务在 http://localhost:3000
2. Web应用在 http://localhost:5173
3. 本地基础设施（PostgreSQL、Redis）已启动
4. 已完成数据库迁移和种子数据初始化

## 案例1：本地PDF问答

### 目标
验证系统对本地PDF文件的处理能力，包括上传、解析、检索和问答功能。

### 步骤

1. **上传PDF文件**
   - 使用API上传示例PDF文件
   ```bash
   curl -X POST "http://localhost:3000/knowledge-bases/{kbId}/documents/upload" \
     -H "Content-Type: multipart/form-data" \
     -F "file=@scripts/sample.pdf"
   ```
   - 或者通过Web界面上传：访问 http://localhost:5173/documents，点击"上传文件"按钮

2. **验证文件处理状态**
   - 检查文档处理状态，确保文件已成功解析和索引
   ```bash
   curl "http://localhost:3000/documents/{documentId}/runs"
   ```

3. **创建助手**
   - 通过API创建助手，关联到包含PDF的知识库
   ```bash
   curl -X POST "http://localhost:3000/assistants" \
     -H "Content-Type: application/json" \
     -d '{"name": "PDF助手", "kbId": "{kbId}", "systemPrompt": "你是一个基于PDF文档的问答助手，回答问题时请引用文档内容。"}'
   ```

4. **测试问答**
   - 向助手提问关于PDF内容的问题
   ```bash
   curl -X POST "http://localhost:3000/assistants/{assistantId}/ask" \
     -H "Content-Type: application/json" \
     -d '{"question": "PDF文档中包含什么内容？"}'
   ```

5. **验证结果**
   - 检查回答是否正确引用了PDF内容
   - 验证回答中是否包含正确的引用标记
   - 检查trace信息，确认检索和回答过程正常

## 案例2：混合web/feed/sitemap问答

### 目标
验证系统对多种外部源的处理能力，包括网页、RSS feed和sitemap。

### 步骤

1. **添加网页源**
   - 向知识库添加网页文档
   ```bash
   curl -X POST "http://localhost:3000/knowledge-bases/{kbId}/documents/web-page" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com", "title": "示例网页"}'
   ```

2. **添加RSS feed源**
   - 向知识库添加RSS feed文档
   ```bash
   curl -X POST "http://localhost:3000/knowledge-bases/{kbId}/documents/feed" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com/feed", "title": "示例RSS Feed"}'
   ```

3. **添加sitemap源**
   - 向知识库添加sitemap文档
   ```bash
   curl -X POST "http://localhost:3000/knowledge-bases/{kbId}/documents/sitemap" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com/sitemap.xml", "title": "示例Sitemap"}'
   ```

4. **创建混合源助手**
   - 创建关联到包含多种源的知识库的助手
   ```bash
   curl -X POST "http://localhost:3000/assistants" \
     -H "Content-Type: application/json" \
     -d '{"name": "混合源助手", "kbId": "{kbId}", "systemPrompt": "你是一个基于多种信息源的问答助手，回答问题时请综合所有可用信息。"}'
   ```

5. **测试跨源问答**
   - 提出需要综合多个源信息的问题
   ```bash
   curl -X POST "http://localhost:3000/assistants/{assistantId}/ask" \
     -H "Content-Type: application/json" \
     -d '{"question": "请比较示例网页和RSS feed中的信息。"}'
   ```

6. **验证结果**
   - 检查回答是否综合了多个源的信息
   - 验证回答中是否正确引用了不同来源
   - 检查trace信息，确认系统正确处理了多种源的检索

## 案例3：no-hit/insufficient-context受控行为

### 目标
验证系统在没有匹配内容或上下文不足时的受控行为。

### 步骤

1. **创建空知识库**
   - 创建一个新的知识库，不添加任何文档
   ```bash
   curl -X POST "http://localhost:3000/knowledge-bases" \
     -H "Content-Type: application/json" \
     -d '{"name": "空知识库", "description": "用于测试no-hit场景的知识库"}'
   ```

2. **创建助手，设置noAnswerBehavior**
   - 创建助手，设置noAnswerBehavior为"say_insufficient_context"
   ```bash
   curl -X POST "http://localhost:3000/assistants" \
     -H "Content-Type: application/json" \
     -d '{"name": "空知识库助手", "kbId": "{kbId}", "systemPrompt": "你是一个问答助手", "answerPolicyJson": {"noAnswerBehavior": "say_insufficient_context"}}'
   ```

3. **测试no-hit场景**
   - 向助手提问任何问题
   ```bash
   curl -X POST "http://localhost:3000/assistants/{assistantId}/ask" \
     -H "Content-Type: application/json" \
     -d '{"question": "什么是人工智能？"}'
   ```

4. **验证结果**
   - 检查回答是否返回上下文不足的提示
   - 验证回答状态是否正确标记为"insufficient_context"
   - 检查trace信息，确认系统正确识别了no-hit场景

## 案例4：trace detail排障

### 目标
验证系统的trace功能，用于排障和分析问答过程。

### 步骤

1. **执行问答请求**
   - 向助手提出一个问题
   ```bash
   curl -X POST "http://localhost:3000/assistants/{assistantId}/ask" \
     -H "Content-Type: application/json" \
     -d '{"question": "PDF文档中的主要内容是什么？"}'
   ```

2. **获取trace详情**
   - 从回答中获取traceId，然后查询trace详情
   ```bash
   curl "http://localhost:3000/traces/{traceId}"
   ```

3. **分析trace信息**
   - 检查检索策略和参数
   - 分析检索结果和得分
   - 查看回答生成过程和引用情况
   - 检查质量评估结果

4. **验证排障流程**
   - 模拟一个失败的场景（例如，使用无效的知识库ID）
   - 检查错误trace信息
   - 验证系统是否正确记录了错误原因和位置

## 测试脚本

### 本地PDF问答测试脚本

```bash
#!/bin/bash

# 设置变量
KB_ID="{kbId}"
ASSISTANT_NAME="PDF助手"
SYSTEM_PROMPT="你是一个基于PDF文档的问答助手，回答问题时请引用文档内容。"

# 上传PDF文件
echo "上传PDF文件..."
PDF_UPLOAD=$(curl -s -X POST "http://localhost:3000/knowledge-bases/$KB_ID/documents/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@scripts/sample.pdf")

DOCUMENT_ID=$(echo $PDF_UPLOAD | jq -r '.id')
echo "上传成功，文档ID: $DOCUMENT_ID"

# 等待文档处理完成
echo "等待文档处理完成..."
sleep 10

# 检查文档处理状态
echo "检查文档处理状态..."
document_status=$(curl -s "http://localhost:3000/documents/$DOCUMENT_ID/runs")
echo $document_status | jq '.[] | {id, status, startedAt, completedAt}'

# 创建助手
echo "创建助手..."
ASSISTANT_CREATION=$(curl -s -X POST "http://localhost:3000/assistants" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$ASSISTANT_NAME\", \"kbId\": \"$KB_ID\", \"systemPrompt\": \"$SYSTEM_PROMPT\"}")

ASSISTANT_ID=$(echo $ASSISTANT_CREATION | jq -r '.id')
echo "助手创建成功，助手ID: $ASSISTANT_ID"

# 测试问答
echo "测试问答..."
QUESTION="PDF文档中包含什么内容？"
ANSWER=$(curl -s -X POST "http://localhost:3000/assistants/$ASSISTANT_ID/ask" \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"$QUESTION\"}")

# 输出结果
echo "问题: $QUESTION"
echo "回答:"
echo $ANSWER | jq '.answer'
echo "引用:"
echo $ANSWER | jq '.citations'
echo "Trace ID:"
echo $ANSWER | jq '.traceId'
```

### 混合web/feed/sitemap问答测试脚本

```bash
#!/bin/bash

# 设置变量
KB_ID="{kbId}"
ASSISTANT_NAME="混合源助手"
SYSTEM_PROMPT="你是一个基于多种信息源的问答助手，回答问题时请综合所有可用信息。"

# 添加网页源
echo "添加网页源..."
curl -s -X POST "http://localhost:3000/knowledge-bases/$KB_ID/documents/web-page" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "title": "示例网页"}'

# 添加RSS feed源
echo "添加RSS feed源..."
curl -s -X POST "http://localhost:3000/knowledge-bases/$KB_ID/documents/feed" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/feed", "title": "示例RSS Feed"}'

# 添加sitemap源
echo "添加sitemap源..."
curl -s -X POST "http://localhost:3000/knowledge-bases/$KB_ID/documents/sitemap" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/sitemap.xml", "title": "示例Sitemap"}'

# 等待源处理完成
echo "等待源处理完成..."
sleep 20

# 创建助手
echo "创建助手..."
ASSISTANT_CREATION=$(curl -s -X POST "http://localhost:3000/assistants" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$ASSISTANT_NAME\", \"kbId\": \"$KB_ID\", \"systemPrompt\": \"$SYSTEM_PROMPT\"}")

ASSISTANT_ID=$(echo $ASSISTANT_CREATION | jq -r '.id')
echo "助手创建成功，助手ID: $ASSISTANT_ID"

# 测试跨源问答
echo "测试跨源问答..."
QUESTION="请比较示例网页和RSS feed中的信息。"
ANSWER=$(curl -s -X POST "http://localhost:3000/assistants/$ASSISTANT_ID/ask" \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"$QUESTION\"}")

# 输出结果
echo "问题: $QUESTION"
echo "回答:"
echo $ANSWER | jq '.answer'
echo "引用:"
echo $ANSWER | jq '.citations'
echo "Trace ID:"
echo $ANSWER | jq '.traceId'
```

### no-hit/insufficient-context测试脚本

```bash
#!/bin/bash

# 创建空知识库
echo "创建空知识库..."
KB_CREATION=$(curl -s -X POST "http://localhost:3000/knowledge-bases" \
  -H "Content-Type: application/json" \
  -d '{"name": "空知识库", "description": "用于测试no-hit场景的知识库"}')

KB_ID=$(echo $KB_CREATION | jq -r '.id')
echo "知识库创建成功，知识库ID: $KB_ID"

# 创建助手，设置noAnswerBehavior
echo "创建助手，设置noAnswerBehavior..."
ASSISTANT_CREATION=$(curl -s -X POST "http://localhost:3000/assistants" \
  -H "Content-Type: application/json" \
  -d '{"name": "空知识库助手", "kbId": "'"$KB_ID"'", "systemPrompt": "你是一个问答助手", "answerPolicyJson": {"noAnswerBehavior": "say_insufficient_context"}}')

ASSISTANT_ID=$(echo $ASSISTANT_CREATION | jq -r '.id')
echo "助手创建成功，助手ID: $ASSISTANT_ID"

# 测试no-hit场景
echo "测试no-hit场景..."
QUESTION="什么是人工智能？"
ANSWER=$(curl -s -X POST "http://localhost:3000/assistants/$ASSISTANT_ID/ask" \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"$QUESTION\"}")

# 输出结果
echo "问题: $QUESTION"
echo "回答:"
echo $ANSWER | jq '.answer'
echo "回答状态:"
echo $ANSWER | jq '.answerStatus'
echo "Trace ID:"
echo $ANSWER | jq '.traceId'
```

### trace detail排障测试脚本

```bash
#!/bin/bash

# 设置变量
ASSISTANT_ID="{assistantId}"

# 执行问答请求
echo "执行问答请求..."
QUESTION="PDF文档中的主要内容是什么？"
ANSWER=$(curl -s -X POST "http://localhost:3000/assistants/$ASSISTANT_ID/ask" \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"$QUESTION\"}")

# 获取traceId
TRACE_ID=$(echo $ANSWER | jq -r '.traceId')
echo "Trace ID: $TRACE_ID"

# 获取trace详情
echo "获取trace详情..."
TRACE_DETAIL=$(curl -s "http://localhost:3000/traces/$TRACE_ID")

# 输出trace信息
echo "Trace详情:"
echo $TRACE_DETAIL | jq '.retrievalMetadataJson'
echo "\n回答状态:"
echo $TRACE_DETAIL | jq '.status'
echo "\n检索到的文档块:"
echo $TRACE_DETAIL | jq '.retrievedChunkIdsJson'
echo "\n质量评估:"
echo $TRACE_DETAIL | jq '.qualityEvaluationJson'

# 模拟失败场景
echo "\n模拟失败场景..."
INVALID_KB_ID="invalid-kb-id"
FAILED_REQUEST=$(curl -s -X POST "http://localhost:3000/assistants" \
  -H "Content-Type: application/json" \
  -d '{"name": "测试助手", "kbId": "'"$INVALID_KB_ID"'", "systemPrompt": "测试助手"}')

echo "失败请求结果:"
echo $FAILED_REQUEST
```

## 结论

通过这些端到端demo案例，我们可以验证RAG系统的核心功能是否正常工作，包括：

1. **本地PDF问答**：验证系统对PDF文件的处理能力
2. **混合web/feed/sitemap问答**：验证系统对多种外部源的处理能力
3. **no-hit/insufficient-context受控行为**：验证系统在没有匹配内容时的受控行为
4. **trace detail排障**：验证系统的trace功能，用于排障和分析

这些案例可以作为系统质量的基准测试，确保系统在不同场景下都能正常工作，并提供可复跑的验证方法。