#!/usr/bin/env python3
"""
对比P5评估和RAGAS评估结果
"""

import json
import argparse
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime

def load_json_file(file_path: Path) -> Dict[str, Any]:
    """加载JSON文件"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def extract_p5_metrics(p5_report: Dict[str, Any]) -> Dict[str, float]:
    """从P5报告中提取关键指标"""
    run_summary = p5_report.get('run', {}).get('summary', {})
    signal_summary = p5_report.get('signalSummary', {})
    
    return {
        'success_rate': run_summary.get('successRate', 0),
        'grounded_rate': run_summary.get('groundedRate', 0),
        'strong_rate': run_summary.get('strongRate', 0),
        'fallback_rate': run_summary.get('fallbackRate', 0),
        'avg_citation_count': run_summary.get('averageCitationCount', 0),
        'no_hit_rate': signal_summary.get('noHit', {}).get('rate', 0),
        'fallback_signal_rate': signal_summary.get('fallback', {}).get('rate', 0),
        'low_score_rate': signal_summary.get('lowScore', {}).get('rate', 0),
    }

def extract_ragas_metrics(ragas_report: Dict[str, Any]) -> Dict[str, float]:
    """从RAGAS报告中提取指标"""
    summary = ragas_report.get('summary', {})
    
    return {
        'answer_relevance': summary.get('answer_relevance', 0),
        'faithfulness': summary.get('faithfulness', 0),
        'context_precision': summary.get('context_precision', 0),
        'context_recall': summary.get('context_recall', 0),
        'answer_correctness': summary.get('answer_correctness', 0),
    }

def generate_comparison_report(
    p5_metrics: Dict[str, float],
    ragas_metrics: Dict[str, float],
    output_path: Path
) -> None:
    """生成对比报告"""
    
    # 计算相关性映射（基于领域知识）
    correlation_mapping = {
        'success_rate': ['answer_relevance', 'answer_correctness'],
        'grounded_rate': ['faithfulness', 'context_recall'],
        'strong_rate': ['answer_relevance', 'faithfulness', 'answer_correctness'],
        'fallback_rate': ['answer_relevance', 'faithfulness'],  # 负相关
        'no_hit_rate': ['context_recall'],  # 负相关
    }
    
    # 生成报告
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report = {
        'timestamp': timestamp,
        'schema_version': 'evaluation-comparison-v1',
        'p5_metrics': p5_metrics,
        'ragas_metrics': ragas_metrics,
        'correlation_analysis': {},
        'recommendations': [],
    }
    
    # 相关性分析
    for p5_metric, related_ragas in correlation_mapping.items():
        p5_value = p5_metrics.get(p5_metric, 0)
        ragas_values = {m: ragas_metrics.get(m, 0) for m in related_ragas}
        
        report['correlation_analysis'][p5_metric] = {
            'p5_value': p5_value,
            'related_ragas_metrics': ragas_values,
            'notes': f"P5的{p5_metric}可能与这些RAGAS指标相关",
        }
    
    # 生成建议
    recommendations = []
    
    # 基于success_rate的建议
    if p5_metrics.get('success_rate', 0) < 0.8:
        recommendations.append({
            'priority': 'high',
            'area': 'answer_quality',
            'suggestion': '成功率较低，建议检查answer_relevance和answer_correctness',
            'ragas_metrics_to_improve': ['answer_relevance', 'answer_correctness'],
        })
    
    # 基于grounded_rate的建议
    if p5_metrics.get('grounded_rate', 0) < 0.7:
        recommendations.append({
            'priority': 'high',
            'area': 'grounding',
            'suggestion': '基于上下文的回答比例较低，建议检查faithfulness和context_recall',
            'ragas_metrics_to_improve': ['faithfulness', 'context_recall'],
        })
    
    # 基于RAGAS指标的建议
    if ragas_metrics.get('faithfulness', 0) < 0.7:
        recommendations.append({
            'priority': 'medium',
            'area': 'faithfulness',
            'suggestion': '忠实度较低，回答可能包含幻觉或未基于上下文',
            'action': '检查retrieval质量或添加faithfulness检测',
        })
    
    if ragas_metrics.get('context_precision', 0) < 0.6:
        recommendations.append({
            'priority': 'medium',
            'area': 'retrieval_precision',
            'suggestion': '上下文精确度较低，检索到的chunk可能不相关',
            'action': '优化retrieval策略或chunking',
        })
    
    report['recommendations'] = recommendations
    
    # 保存报告
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    # 生成Markdown摘要
    md_path = output_path.with_suffix('.md')
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(generate_markdown_summary(report))
    
    print(f"对比报告已生成:")
    print(f"  JSON: {output_path}")
    print(f"  Markdown: {md_path}")

def generate_markdown_summary(report: Dict[str, Any]) -> str:
    """生成Markdown格式摘要"""
    lines = [
        "# 评估结果对比报告",
        "",
        f"生成时间: {report['timestamp']}",
        f"版本: {report['schema_version']}",
        "",
        "## P5评估指标",
        "",
        "| 指标 | 值 | 说明 |",
        "|------|----|------|",
    ]
    
    p5_metrics = report['p5_metrics']
    for metric, value in p5_metrics.items():
        lines.append(f"| {metric} | {value:.3f} | {get_p5_metric_description(metric)} |")
    
    lines.extend([
        "",
        "## RAGAS评估指标",
        "",
        "| 指标 | 值 | 说明 |",
        "|------|----|------|",
    ])
    
    ragas_metrics = report['ragas_metrics']
    for metric, value in ragas_metrics.items():
        if value is not None:
            lines.append(f"| {metric} | {value:.3f} | {get_ragas_metric_description(metric)} |")
    
    lines.extend([
        "",
        "## 建议",
        "",
    ])
    
    recommendations = report['recommendations']
    if recommendations:
        for i, rec in enumerate(recommendations, 1):
            lines.append(f"{i}. **[{rec['priority'].upper()}] {rec['area']}**: {rec['suggestion']}")
            if 'action' in rec:
                lines.append(f"   - 行动: {rec['action']}")
            if 'ragas_metrics_to_improve' in rec:
                lines.append(f"   - 关注RAGAS指标: {', '.join(rec['ragas_metrics_to_improve'])}")
            lines.append("")
    else:
        lines.append("✅ 所有指标均在可接受范围内，无需立即行动。")
    
    return "\n".join(lines)

def get_p5_metric_description(metric: str) -> str:
    """获取P5指标描述"""
    descriptions = {
        'success_rate': '回答成功比例',
        'grounded_rate': '基于上下文的回答比例',
        'strong_rate': '强质量回答比例',
        'fallback_rate': '回退回答比例',
        'avg_citation_count': '平均引用数量',
        'no_hit_rate': '无检索结果比例',
        'fallback_signal_rate': '回退信号比例',
        'low_score_rate': '低分检索比例',
    }
    return descriptions.get(metric, '未知指标')

def get_ragas_metric_description(metric: str) -> str:
    """获取RAGAS指标描述"""
    descriptions = {
        'answer_relevance': '答案相关性（0-1）',
        'faithfulness': '忠实度（基于上下文）',
        'context_precision': '上下文精确度',
        'context_recall': '上下文召回率',
        'answer_correctness': '答案正确性（需ground truth）',
    }
    return descriptions.get(metric, '未知指标')

def main():
    parser = argparse.ArgumentParser(description="对比P5和RAGAS评估结果")
    parser.add_argument("--p5-report", required=True, help="P5评估报告JSON文件")
    parser.add_argument("--ragas-report", required=True, help="RAGAS评估报告JSON文件")
    parser.add_argument("--output", default="./comparison_report.json", help="输出文件路径")
    
    args = parser.parse_args()
    
    p5_report_path = Path(args.p5_report)
    ragas_report_path = Path(args.ragas_report)
    output_path = Path(args.output)
    
    # 确保输出目录存在
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        print("加载P5评估报告...")
        p5_report = load_json_file(p5_report_path)
        
        print("加载RAGAS评估报告...")
        ragas_report = load_json_file(ragas_report_path)
        
        print("提取指标...")
        p5_metrics = extract_p5_metrics(p5_report)
        ragas_metrics = extract_ragas_metrics(ragas_report)
        
        print("生成对比报告...")
        generate_comparison_report(p5_metrics, ragas_metrics, output_path)
        
        print("\n✅ 对比完成!")
        
    except Exception as e:
        print(f"❌ 对比失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())