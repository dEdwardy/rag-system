# RAGAS评估集成

将RAGAS评估集成到现有RAG系统评估框架中。

## 快速开始

### 1. 安装依赖
```bash
cd scripts/ragas-evaluation
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

pip install -r requirements.txt
```

### 2. 设置环境变量
```bash
# 复制.env.example到.env并编辑
cp .env.example .env
```

### 3. 运行评估
```bash
# 基本用法（使用P5演示短列表）
python ragas_eval.py

# 指定API URL
python ragas_eval.py --api-url http://localhost:3000

# 使用特定评估运行
python ragas_eval.py --eval-run-id <eval-run-id>

# 指定输出目录
python ragas_eval.py --output-dir ./my_reports
```

## 与现有评估集成

### 数据流
```
现有P5评估 → 生成JSON报告 → RAGAS脚本读取 → RAGAS评估 → 对比报告
```

### 对比现有指标
现有P5指标：
- `successRate` - 成功率
- `groundedRate` - 基于上下文的回答比例
- `strongRate` - 强质量回答比例
- `fallbackRate` - 回退比例

RAGAS指标：
- `answer_relevance` - 答案相关性
- `faithfulness` - 忠实度
- `context_precision` - 上下文精确度
- `context_recall` - 上下文召回率
- `answer_correctness` - 答案正确性（需要ground truth）

### 集成脚本
```python
# scripts/compare_evaluations.py
import json
from pathlib import Path

def compare_p5_ragas(p5_report_path: Path, ragas_report_path: Path):
    """对比P5和RAGAS评估结果"""
    with open(p5_report_path, 'r') as f:
        p5_data = json.load(f)
    
    with open(ragas_report_path, 'r') as f:
        ragas_data = json.load(f)
    
    # 生成对比报告
    # ...
```

## 文件结构
```
scripts/ragas-evaluation/
├── ragas_eval.py          # 主评估脚本
├── requirements.txt       # Python依赖
├── README.md             # 本文档
├── .env.example          # 环境变量示例
└── compare_evaluations.py # 对比脚本（待实现）
```

## 下一步

1. **扩展数据集**：添加更多测试问题和ground truth
2. **自动化集成**：将RAGAS评估加入CI/CD
3. **可视化**：创建对比仪表板
4. **警报**：基于RAGAS分数设置质量门控

## 注意事项

1. **需要OpenAI API密钥**：RAGAS使用LLM进行评估
2. **ground truth**：answer_correctness需要参考答案
3. **性能**：评估可能较慢，建议分批进行
4. **成本**：使用LLM评估会产生API调用成本