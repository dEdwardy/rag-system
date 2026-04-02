#!/usr/bin/env python3
"""
RAGAS评估脚本 - 与现有P5评估集成
"""

import os
import json
import asyncio
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

import requests
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    answer_relevance,
    faithfulness,
    context_precision,
    context_recall,
    answer_correctness,
)
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

class RAGASEvaluator:
    def __init__(self, api_base_url: str = "http://localhost:3000"):
        self.api_base_url = api_base_url
        self.session_cookie = None
        
    def login(self, user_id: Optional[str] = None) -> str:
        """登录获取session cookie"""
        login_url = f"{self.api_base_url}/auth/login"
        payload = {"userId": user_id} if user_id else {}
        
        response = requests.post(login_url, json=payload)
        if response.status_code != 200:
            raise Exception(f"登录失败: {response.status_code} - {response.text}")
        
        # 提取cookie
        set_cookie = response.headers.get('set-cookie', '')
        if not set_cookie:
            raise Exception("未收到session cookie")
        
        self.session_cookie = set_cookie.split(';')[0]
        return self.session_cookie
    
    def fetch_eval_data(self, eval_run_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        从API获取评估数据
        如果提供eval_run_id，获取特定运行的数据
        否则使用P5演示短列表
        """
        if not self.session_cookie:
            self.login()
        
        headers = {"Cookie": self.session_cookie}
        
        if eval_run_id:
            # 获取特定评估运行
            run_url = f"{self.api_base_url}/eval/question-sets/{eval_run_id}/runs"
            response = requests.get(run_url, headers=headers)
            if response.status_code != 200:
                raise Exception(f"获取评估运行失败: {response.status_code}")
            return response.json()
        else:
            # 使用P5演示短列表
            shortlist_path = Path(__file__).parent.parent / "apps/api/scripts/p5-demo-shortlist.json"
            if not shortlist_path.exists():
                raise FileNotFoundError(f"找不到短列表文件: {shortlist_path}")
            
            with open(shortlist_path, 'r', encoding='utf-8') as f:
                shortlist = json.load(f)
            
            # 提取问题
            questions = []
            for item in shortlist.get('selected', []):
                if 'questions' in item:
                    questions.extend(item['questions'])
            
            return questions
    
    def fetch_trace_data(self, trace_id: str) -> Dict[str, Any]:
        """获取trace详情"""
        if not self.session_cookie:
            self.login()
        
        headers = {"Cookie": self.session_cookie}
        trace_url = f"{self.api_base_url}/traces/{trace_id}"
        
        response = requests.get(trace_url, headers=headers)
        if response.status_code != 200:
            raise Exception(f"获取trace失败: {response.status_code}")
        
        return response.json()
    
    def prepare_ragas_dataset(self, eval_data: List[Dict[str, Any]]) -> Dataset:
        """准备RAGAS评估数据集"""
        questions = []
        answers = []
        contexts_list = []
        ground_truths = []
        
        for item in eval_data:
            question = item.get('question', '')
            answer = item.get('answer', '') or item.get('generatedAnswer', '')
            
            # 获取上下文（从trace或item中提取）
            contexts = []
            trace_id = item.get('traceId')
            if trace_id:
                try:
                    trace = self.fetch_trace_data(trace_id)
                    # 提取retrieved chunks作为上下文
                    if 'retrievedChunks' in trace:
                        contexts = [chunk.get('text', '') for chunk in trace['retrievedChunks']]
                except Exception as e:
                    print(f"获取trace {trace_id} 失败: {e}")
            
            # ground truth（如果有）
            ground_truth = item.get('expectedAnswer', '') or item.get('reference', '')
            
            questions.append(question)
            answers.append(answer)
            contexts_list.append(contexts)
            ground_truths.append(ground_truth)
        
        # 创建Dataset
        dataset_dict = {
            "question": questions,
            "answer": answers,
            "contexts": contexts_list,
            "ground_truth": ground_truths,
        }
        
        return Dataset.from_dict(dataset_dict)
    
    def run_evaluation(self, dataset: Dataset) -> Dict[str, Any]:
        """运行RAGAS评估"""
        # 选择关键指标
        metrics = [
            answer_relevance,
            faithfulness,
            context_precision,
            context_recall,
        ]
        
        # 如果有ground truth，添加answer_correctness
        if any(gt for gt in dataset['ground_truth']):
            metrics.append(answer_correctness)
        
        # 运行评估
        result = evaluate(dataset, metrics=metrics)
        
        return {
            "scores": result.to_pandas().to_dict(orient='records'),
            "summary": {
                "answer_relevance": result["answer_relevance"].mean(),
                "faithfulness": result["faithfulness"].mean(),
                "context_precision": result["context_precision"].mean(),
                "context_recall": result["context_recall"].mean(),
                "answer_correctness": result.get("answer_correctness", {}).mean() if "answer_correctness" in result else None,
            }
        }
    
    def generate_report(self, ragas_results: Dict[str, Any], output_dir: Path) -> None:
        """生成评估报告"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # JSON报告
        json_report = {
            "timestamp": timestamp,
            "schema_version": "ragas-evaluation-v1",
            "summary": ragas_results["summary"],
            "detailed_scores": ragas_results["scores"],
        }
        
        json_path = output_dir / f"ragas_report_{timestamp}.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(json_report, f, indent=2, ensure_ascii=False)
        
        # Markdown报告
        md_path = output_dir / f"ragas_report_{timestamp}.md"
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(self._generate_markdown_report(json_report))
        
        print(f"报告已生成:")
        print(f"  JSON: {json_path}")
        print(f"  Markdown: {md_path}")
    
    def _generate_markdown_report(self, report: Dict[str, Any]) -> str:
        """生成Markdown格式报告"""
        summary = report["summary"]
        
        lines = [
            "# RAGAS评估报告",
            "",
            f"生成时间: {report['timestamp']}",
            f"版本: {report['schema_version']}",
            "",
            "## 指标摘要",
            "",
            "| 指标 | 平均分 | 说明 |",
            "|------|--------|------|",
            f"| Answer Relevance | {summary.get('answer_relevance', 0):.3f} | 答案相关性 |",
            f"| Faithfulness | {summary.get('faithfulness', 0):.3f} | 忠实度（基于上下文） |",
            f"| Context Precision | {summary.get('context_precision', 0):.3f} | 上下文精确度 |",
            f"| Context Recall | {summary.get('context_recall', 0):.3f} | 上下文召回率 |",
        ]
        
        if summary.get('answer_correctness') is not None:
            lines.append(f"| Answer Correctness | {summary['answer_correctness']:.3f} | 答案正确性 |")
        
        lines.extend([
            "",
            "## 详细分数",
            "",
            "| # | Question | Answer Relevance | Faithfulness | Context Precision | Context Recall |",
            "|---|----------|------------------|--------------|-------------------|----------------|",
        ])
        
        for i, score in enumerate(report["detailed_scores"]):
            lines.append(
                f"| {i+1} | {score.get('question', '')[:50]}... | "
                f"{score.get('answer_relevance', 0):.3f} | "
                f"{score.get('faithfulness', 0):.3f} | "
                f"{score.get('context_precision', 0):.3f} | "
                f"{score.get('context_recall', 0):.3f} |"
            )
        
        return "\n".join(lines)

async def main():
    parser = argparse.ArgumentParser(description="RAGAS评估脚本")
    parser.add_argument("--api-url", default="http://localhost:3000", help="API基础URL")
    parser.add_argument("--eval-run-id", help="评估运行ID（可选）")
    parser.add_argument("--output-dir", default="./ragas_reports", help="输出目录")
    parser.add_argument("--user-id", help="用户ID（用于登录）")
    
    args = parser.parse_args()
    
    # 创建输出目录
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 初始化评估器
    evaluator = RAGASEvaluator(api_base_url=args.api_url)
    
    try:
        print("1. 登录并获取评估数据...")
        evaluator.login(args.user_id)
        
        print("2. 获取评估数据...")
        eval_data = evaluator.fetch_eval_data(args.eval_run_id)
        print(f"   获取到 {len(eval_data)} 个评估项")
        
        print("3. 准备RAGAS数据集...")
        dataset = evaluator.prepare_ragas_dataset(eval_data)
        print(f"   数据集大小: {len(dataset)}")
        
        print("4. 运行RAGAS评估...")
        ragas_results = evaluator.run_evaluation(dataset)
        
        print("5. 生成报告...")
        evaluator.generate_report(ragas_results, output_dir)
        
        print("\n✅ 评估完成!")
        
        # 打印摘要
        summary = ragas_results["summary"]
        print("\n📊 评估摘要:")
        for metric, score in summary.items():
            if score is not None:
                print(f"  {metric}: {score:.3f}")
        
    except Exception as e:
        print(f"❌ 评估失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit(asyncio.run(main()))