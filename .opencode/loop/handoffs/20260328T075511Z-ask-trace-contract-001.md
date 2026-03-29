# ask-trace-contract-001

- 标题: Align ask and trace contract wording
- 状态: completed
- 代理: rag-build
- 会话: ses_2cc94676affeFk1gMYxQs7i2X1
- 消息: msg_d33704eb80018FeLaEfnPQ5IwI
- 开始: 2026-03-28 15:49:42
- 收到: 2026-03-28 15:55:11
- 完成: 2026-03-28 15:55:11

## 结果
[
  {
    "type": "step-start",
    "snapshot": "f40f68f8f6bc1547298a17530b0fa713da76080e",
    "id": "prt_d337057e50011H04SVyAwBVY9Y",
    "sessionID": "ses_2cc94676affeFk1gMYxQs7i2X1",
    "messageID": "msg_d33704eb80018FeLaEfnPQ5IwI"
  },
  {
    "type": "reasoning",
    "text": "",
    "metadata": {
      "openai": {
        "itemId": "rs_0734ab86f9e78fae0169c789511a348191bcdbf9e9b4c4c708",
        "reasoningEncryptedContent": "gAAAAABpx4lRwy7qsdipGh_-Ulyn_XHnY0OXV_sd5Lpv-dTmjdaWEC2fN2PFSt6XxKwy4aaQKdeZ0evPOCEHz3oJ7c3CQD1iOsGU4Inh_Nzj4MfbhfmHQWnGZKdtc7gUtMfrYKT5hlJpLl0ffrMPpaovujgquRW1c6ZvNgjCE6lnDm73NyVsFxm8blNPRYmpfeQ_EOSPInsS-6oRfxg2fQ5KHHQQ4FPojw76NnPzNiaZpzkWX9tnVxxPaHd6X_ZYvnJQjhGR_O3Wg5ZSKv0nZoA2DLwQl2XrUJ8tJVuTRnYQNJywAW_PM_vCJ_Hbc-SNcROw2vCIgX2f1r5WMmqrhpS1GmyF6kky_t5VzLBSZAGHOmCzDFo7UmROY1glJpJ5cetZdvyb9AF_kXhU7tzFFeAonj2z1QWXM5k4zuszGr2Kz-1Y7Ihi9aaiw8nEYeaS_4oPOFQ6CmGVrFvLOXYdKQQekBn32GhbrbqjkaIUhvl6eNo2L7BiPZ44sgdUQKpnYPiyPNCdEaFw7SLdL5dcU7johsGQ0l22V3My6TendPO8zLw5tSUX53mfRvmLvmxbEHDnajA39yafLk8sDllxNS4p2o3bSgvLqIIu2eIfCBrsJwOGEYs-kZyZxqP18DcqDYV8yivDQwwp5-L35WfEVYQCfJsJTqD_lchQKxMLVjcs86Xt8FBbw_7xEtG0URXHkQ63LW1CKd_mo7BmViQUBJby56nT6gpfxySY34p_kJoVtru6C9SDtdl_Om3fMWpPibL3rWtAA1XNOmZD3QxB62GybA-1-haIDDv2zOTi_kzpXbXW0wE79-omUxuVQSxyFEwY-V-2mfrb"
      }
    },
    "time": {
      "start": 1774684494528
    },
    "id": "prt_d33705ac0001B3MyXCnEO2a6wZ",
    "sessionID": "ses_2cc94676affeFk1gMYxQs7i2X1",
    "messageID": "msg_d33704eb80018FeLaEfnPQ5IwI"
  }
]

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read `AGENTS.md`, `docs/next_steps_rag_project_plan.md`, `docs/current-progress.md`, and the relevant API contract files before editing.

Task: align the wording used by ask response and trace summary for shared contract fields.

Focus files:
- `apps/api/src/modules/traces/traces.service.ts`
- `apps/api/src/modules/assistants/ask-assistant.service.ts`
- `packages/shared/src/trace-contracts.ts`

Rules:
- keep the change additive and behavior-preserving
- do not change retrieval semantics, persistence, or schema shape
- if a helper is needed, make it the smallest possible shared helper

Deliverable:
- make the wording consistent across ask and trace paths
- add or update focused regression tests
- report exact files changed and the focused validation command you ran
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

